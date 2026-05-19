"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Headphones, Loader2, Mic, MessageSquareText, PhoneOff, Send } from "lucide-react";
import { languageLabels, type ParticipantRole, type PatientLanguage } from "@/lib/languages";
import { OpenAIRealtimeClient } from "@/lib/openai-realtime-client";
import { normalizeClinicTranslation } from "@/lib/clinic-glossary";
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
const CONSULTATION_TRANSLATION_QUIET_MS = 900;
const CONSULTATION_TRANSLATION_MAX_MS = 7000;
const PROCEDURE_TRANSLATION_QUIET_MS = 700;
const PROCEDURE_TRANSLATION_MAX_MS = 5500;
const TTS_DEBUG_VERSION = "device-tts-only-2026-05-19.1";
const GOOGLE_TTS_MARKET_URL = "market://details?id=com.google.android.tts";
const GOOGLE_TTS_WEB_URL = "https://play.google.com/store/apps/details?id=com.google.android.tts";

const speechLanguageByPatientLanguage: Record<PatientLanguage | "ko", string> = {
  ko: "ko-KR",
  zh: "zh-CN",
  ja: "ja-JP",
  en: "en-US",
  ru: "ru-RU",
  vi: "vi-VN",
  id: "id-ID",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT"
};

const consultationTextCopy: Record<PatientLanguage, { placeholder: string; submit: string; voice: string; title: string }> = {
  zh: { title: "请输入文字", placeholder: "请在这里输入您想说的话。", submit: "发送翻译", voice: "也可以用语音说话" },
  ja: { title: "テキストで入力してください", placeholder: "伝えたい内容をここに入力してください。", submit: "翻訳を送信", voice: "音声でも話せます" },
  en: { title: "Type your message", placeholder: "Type what you want to say here.", submit: "Send translation", voice: "You can also use voice" },
  ru: { title: "Введите сообщение", placeholder: "Введите здесь то, что хотите сказать.", submit: "Отправить перевод", voice: "Можно также говорить голосом" },
  vi: { title: "Nhập tin nhắn", placeholder: "Nhập điều bạn muốn nói ở đây.", submit: "Gửi bản dịch", voice: "Bạn cũng có thể nói bằng giọng nói" },
  id: { title: "Ketik pesan Anda", placeholder: "Ketik apa yang ingin Anda sampaikan di sini.", submit: "Kirim terjemahan", voice: "Anda juga bisa menggunakan suara" },
  fr: { title: "Saisissez votre message", placeholder: "Écrivez ici ce que vous voulez dire.", submit: "Envoyer la traduction", voice: "Vous pouvez aussi parler" },
  es: { title: "Escriba su mensaje", placeholder: "Escriba aquí lo que quiere decir.", submit: "Enviar traducción", voice: "También puede usar la voz" },
  de: { title: "Nachricht eingeben", placeholder: "Geben Sie hier ein, was Sie sagen möchten.", submit: "Übersetzung senden", voice: "Sie können auch sprechen" },
  it: { title: "Scrivi il messaggio", placeholder: "Scrivi qui ciò che vuoi dire.", submit: "Invia traduzione", voice: "Puoi anche parlare" },
  pt: { title: "Digite sua mensagem", placeholder: "Digite aqui o que você quer dizer.", submit: "Enviar tradução", voice: "Você também pode falar" }
};

const consultationDeliveryStatusCopy: Record<PatientLanguage, { sending: string; failed: string }> = {
  zh: { sending: "正在发送", failed: "发送失败" },
  ja: { sending: "送信中", failed: "送信に失敗しました" },
  en: { sending: "Sending", failed: "Send failed" },
  ru: { sending: "Отправка", failed: "Не удалось отправить" },
  vi: { sending: "Đang gửi", failed: "Gửi thất bại" },
  id: { sending: "Mengirim", failed: "Gagal mengirim" },
  fr: { sending: "Envoi", failed: "Échec de l'envoi" },
  es: { sending: "Enviando", failed: "Error al enviar" },
  de: { sending: "Wird gesendet", failed: "Senden fehlgeschlagen" },
  it: { sending: "Invio", failed: "Invio non riuscito" },
  pt: { sending: "Enviando", failed: "Falha ao enviar" }
};

type ConsultationExampleCategory = "reservation" | "procedure" | "price";

const consultationExampleCategories: Record<
  PatientLanguage,
  Record<ConsultationExampleCategory, { label: string; examples: string[] }>
> = {
  zh: {
    reservation: { label: "预约相关", examples: ["我没有预约。今天可以咨询吗？", "我想预约咨询。"] },
    procedure: { label: "治疗咨询", examples: ["我想咨询皮肤营养注射。", "我想咨询提升治疗。", "我想咨询适合我的治疗。"] },
    price: { label: "价格咨询", examples: ["我想看完整价目表。", "可以刷卡付款吗？"] }
  },
  ja: {
    reservation: { label: "予約について", examples: ["予約していません。今日カウンセリングできますか？", "カウンセリングを予約したいです。"] },
    procedure: { label: "施術相談", examples: ["スキンブースターの施術を相談したいです。", "リフティング施術を相談したいです。", "自分に合う施術を相談したいです。"] },
    price: { label: "料金について", examples: ["全体の料金表を見たいです。", "カードで支払えますか？"] }
  },
  en: {
    reservation: { label: "Reservation", examples: ["I don't have an appointment. Can I have a consultation today?", "I would like to book a consultation."] },
    procedure: { label: "Procedure", examples: ["I would like to ask about skin booster treatment.", "I would like to ask about lifting treatment.", "I would like to ask which procedure is suitable for me."] },
    price: { label: "Price", examples: ["I would like to see the full price list.", "Can I pay by card?"] }
  },
  ru: {
    reservation: { label: "Запись", examples: ["У меня нет записи. Можно пройти консультацию сегодня?", "Я хочу записаться на консультацию."] },
    procedure: { label: "Процедуры", examples: ["Я хочу проконсультироваться по поводу скинбустера.", "Я хочу проконсультироваться по поводу лифтинг-процедуры.", "Я хочу узнать какая процедура мне подходит."] },
    price: { label: "Стоимость", examples: ["Я хочу посмотреть полный прайс-лист.", "Можно оплатить картой?"] }
  },
  vi: {
    reservation: { label: "Đặt lịch", examples: ["Tôi chưa đặt lịch. Hôm nay tôi có thể tư vấn được không?", "Tôi muốn đặt lịch tư vấn."] },
    procedure: { label: "Tư vấn liệu trình", examples: ["Tôi muốn tư vấn về liệu trình skin booster.", "Tôi muốn tư vấn về liệu trình nâng cơ.", "Tôi muốn hỏi liệu trình nào phù hợp với mình."] },
    price: { label: "Giá", examples: ["Tôi muốn xem bảng giá đầy đủ.", "Tôi có thể thanh toán bằng thẻ không?"] }
  },
  id: {
    reservation: { label: "Reservasi", examples: ["Saya belum membuat janji. Apakah saya bisa konsultasi hari ini?", "Saya ingin membuat janji konsultasi."] },
    procedure: { label: "Konsultasi perawatan", examples: ["Saya ingin konsultasi tentang perawatan skin booster.", "Saya ingin konsultasi tentang perawatan lifting.", "Saya ingin bertanya perawatan apa yang cocok untuk saya."] },
    price: { label: "Harga", examples: ["Saya ingin melihat daftar harga lengkap.", "Apakah bisa bayar dengan kartu?"] }
  },
  fr: {
    reservation: { label: "Rendez-vous", examples: ["Je n'ai pas de rendez-vous. Puis-je avoir une consultation aujourd'hui ?", "Je voudrais réserver une consultation."] },
    procedure: { label: "Traitement", examples: ["Je voudrais me renseigner sur le skin booster.", "Je voudrais me renseigner sur le traitement lifting.", "Je voudrais savoir quel traitement me convient."] },
    price: { label: "Tarifs", examples: ["Je voudrais voir la liste complète des prix.", "Puis-je payer par carte ?"] }
  },
  es: {
    reservation: { label: "Reserva", examples: ["No tengo cita. ¿Puedo tener una consulta hoy?", "Quisiera reservar una consulta."] },
    procedure: { label: "Tratamiento", examples: ["Quisiera consultar sobre el tratamiento skin booster.", "Quisiera consultar sobre el tratamiento lifting.", "Quisiera saber qué tratamiento es adecuado para mí."] },
    price: { label: "Precio", examples: ["Quisiera ver la lista completa de precios.", "¿Puedo pagar con tarjeta?"] }
  },
  de: {
    reservation: { label: "Termin", examples: ["Ich habe keinen Termin. Kann ich heute eine Beratung bekommen?", "Ich möchte einen Beratungstermin buchen."] },
    procedure: { label: "Behandlung", examples: ["Ich möchte mich zum Skin-Booster beraten lassen.", "Ich möchte mich zu einer Lifting-Behandlung beraten lassen.", "Ich möchte wissen welche Behandlung für mich geeignet ist."] },
    price: { label: "Preis", examples: ["Ich möchte die vollständige Preisliste sehen.", "Kann ich mit Karte bezahlen?"] }
  },
  it: {
    reservation: { label: "Prenotazione", examples: ["Non ho un appuntamento. Posso fare una consulenza oggi?", "Vorrei prenotare una consulenza."] },
    procedure: { label: "Trattamento", examples: ["Vorrei chiedere informazioni sul trattamento skin booster.", "Vorrei chiedere informazioni sul trattamento lifting.", "Vorrei sapere quale trattamento è adatto a me."] },
    price: { label: "Prezzo", examples: ["Vorrei vedere il listino prezzi completo.", "Posso pagare con carta?"] }
  },
  pt: {
    reservation: { label: "Agendamento", examples: ["Não tenho agendamento. Posso fazer uma consulta hoje?", "Gostaria de marcar uma consulta."] },
    procedure: { label: "Procedimento", examples: ["Gostaria de perguntar sobre o tratamento skin booster.", "Gostaria de perguntar sobre o tratamento lifting.", "Gostaria de saber qual procedimento é adequado para mim."] },
    price: { label: "Preço", examples: ["Gostaria de ver a lista completa de preços.", "Posso pagar com cartão?"] }
  }
};

type StaffFollowUpSuggestionSet = {
  label: string;
  keywords: string[];
  suggestions: string[];
};

const defaultStaffFollowUpSuggestionSet: StaffFollowUpSuggestionSet = {
  label: "상담 흐름 다음 질문",
  keywords: [],
  suggestions: [
    "어떤 부분이 가장 고민이신지 조금 더 자세히 말씀해주세요.",
    "처음 방문이신가요, 아니면 이전 상담이나 시술 경험이 있으신가요?",
    "원하시는 변화나 가장 중요하게 생각하시는 점이 있으실까요?",
    "불편하신 증상이나 피하고 싶은 부분이 있다면 알려주세요."
  ]
};

const staffFollowUpSuggestionSets: StaffFollowUpSuggestionSet[] = [
  {
    label: "예약 상담 다음 질문",
    keywords: ["예약", "오늘", "상담가능", "상담예약", "날짜", "시간", "appointment", "book", "today"],
    suggestions: [
      "오늘 상담을 원하시면 가능한 시간을 확인해드리겠습니다.",
      "희망하시는 상담 날짜와 시간대를 알려주세요.",
      "처음 방문이신가요, 재방문이신가요?",
      "상담받고 싶은 시술이나 고민 부위가 있으실까요?"
    ]
  },
  {
    label: "가격 문의 다음 질문",
    keywords: ["가격", "비용", "금액", "가격표", "결제", "카드", "현금", "할부", "price", "cost", "pay", "card"],
    suggestions: [
      "어떤 시술의 가격을 확인하고 싶으신가요?",
      "원하시는 부위나 시술명을 알려주시면 더 정확히 안내드릴게요.",
      "카드 결제는 가능하며, 할부 가능 여부도 함께 확인해드리겠습니다.",
      "상담 후 개인 상태에 따라 최종 비용이 달라질 수 있습니다."
    ]
  },
  {
    label: "시술 문의 다음 질문",
    keywords: ["시술", "스킨부스터", "리프팅", "보톡스", "필러", "레이저", "제모", "lifting", "booster", "treatment", "procedure"],
    suggestions: [
      "상담 원하시는 부위가 어디인지 알려주세요.",
      "언제쯤 시술을 받고 싶으신가요?",
      "이전에 같은 시술을 받아보신 적이 있으신가요?",
      "원하시는 효과나 걱정되는 부분을 알려주시면 더 정확히 상담드릴게요."
    ]
  },
  {
    label: "맞춤 상담 다음 질문",
    keywords: ["맞는", "추천", "무엇", "어떤", "고민", "피부", "탄력", "주름", "여드름", "기미", "모공", "suitable", "recommend"],
    suggestions: [
      "가장 개선하고 싶은 고민을 하나만 먼저 말씀해주실 수 있을까요?",
      "피부 상태나 고민이 시작된 시기를 알려주세요.",
      "다운타임이 짧은 시술을 원하시는지, 효과 중심 상담을 원하시는지 알려주세요.",
      "예산이나 회복 기간에 대한 선호가 있으실까요?"
    ]
  },
  {
    label: "주의사항 확인 질문",
    keywords: ["알레르기", "복용", "약", "질환", "임신", "수유", "부작용", "통증", "붓기", "멍", "회복", "allergy", "medicine", "pregnant", "pain"],
    suggestions: [
      "현재 복용 중인 약이나 알레르기가 있으신가요?",
      "임신, 수유 중이거나 치료 중인 질환이 있으신가요?",
      "이전 시술 후 불편했던 반응이 있었는지 알려주세요.",
      "통증이나 회복 기간에 대해 가장 걱정되는 부분이 있으실까요?"
    ]
  }
];

function getStaffFollowUpSuggestionSet(message?: TranslationMessage) {
  if (!message || message.speaker !== "patient") return defaultStaffFollowUpSuggestionSet;

  const text = message.text.toLowerCase().replace(/\s+/g, "");
  const ranked = staffFollowUpSuggestionSets
    .map((set) => ({
      set,
      score: set.keywords.reduce((total, keyword) => total + (text.includes(keyword.toLowerCase().replace(/\s+/g, "")) ? 1 : 0), 0)
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.score ? ranked[0].set : defaultStaffFollowUpSuggestionSet;
}

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
  deliveryStatus?: "sending" | "failed";
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
  },
  fr: {
    statusLabels: {
      waiting_for_patient: "En attente",
      ready: "Prêt",
      staff_speaking: "Le personnel parle",
      translating_to_patient: "Traduction",
      patient_listening: "Texte affiché",
      patient_speaking: "Vous parlez",
      translating_to_staff: "Traduction",
      staff_listening: "Texte affiché",
      ended: "Terminé",
      error: "Erreur"
    },
    statusDescriptions: {
      waiting_for_patient: "En attente de l'ouverture de la salle.",
      ready: "Touchez le microphone et parlez.",
      staff_speaking: "Le personnel parle.",
      translating_to_patient: "Traduction pour vous.",
      patient_listening: "Le texte traduit est affiché.",
      patient_speaking: "Nous vous écoutons.",
      translating_to_staff: "Traduction pour le personnel.",
      staff_listening: "Le texte traduit est affiché.",
      ended: "La session d'interprétation est terminée.",
      error: "Une erreur de connexion s'est produite."
    },
    primary: { ended: "Session terminée", speaking: "Touchez à nouveau pour terminer", ready: "Touchez et parlez", waiting: "Veuillez patienter" },
    helper: { speaking: "Touchez à nouveau quand vous avez terminé", idle: "Veuillez parler une personne à la fois" },
    errors: { mic: "Le microphone n'est pas disponible.", busy: "L'autre personne parle. Veuillez réessayer dans un instant." },
    transcript: { title: "Interprétation récente", empty: "La traduction de l'autre personne apparaîtra ici.", staff: "Traduction du personnel", patient: "Traduction du patient" },
    end: "Terminer l'interprétation",
    backWarning: { title: "Veuillez rester sur cet écran pendant l'interprétation.", body: "Si la voix ne fonctionne plus, demandez au personnel de créer une nouvelle salle." },
    connecting: { title: "Connexion à l'interprétation", body: "Première connexion en cours. Veuillez patienter.", hint: "Parlez lorsque le bouton devient rouge." }
  },
  es: {
    statusLabels: {
      waiting_for_patient: "En espera",
      ready: "Listo",
      staff_speaking: "El personal está hablando",
      translating_to_patient: "Traduciendo",
      patient_listening: "Texto mostrado",
      patient_speaking: "Usted está hablando",
      translating_to_staff: "Traduciendo",
      staff_listening: "Texto mostrado",
      ended: "Finalizado",
      error: "Error"
    },
    statusDescriptions: {
      waiting_for_patient: "Esperando a que se abra la sala.",
      ready: "Toque el micrófono y hable.",
      staff_speaking: "El personal está hablando.",
      translating_to_patient: "Traduciendo para usted.",
      patient_listening: "El texto traducido se ha mostrado.",
      patient_speaking: "Le estamos escuchando.",
      translating_to_staff: "Traduciendo para el personal.",
      staff_listening: "El texto traducido se ha mostrado.",
      ended: "La sesión de interpretación ha terminado.",
      error: "Se produjo un error de conexión."
    },
    primary: { ended: "Sesión finalizada", speaking: "Toque de nuevo para terminar", ready: "Toque y hable", waiting: "Espere un momento" },
    helper: { speaking: "Toque de nuevo cuando termine", idle: "Hablen de uno en uno" },
    errors: { mic: "El micrófono no está disponible.", busy: "La otra persona está hablando. Inténtelo de nuevo en un momento." },
    transcript: { title: "Interpretación reciente", empty: "La traducción de la otra persona aparecerá aquí.", staff: "Traducción del personal", patient: "Traducción del paciente" },
    end: "Finalizar interpretación",
    backWarning: { title: "Permanezca en esta pantalla durante la interpretación.", body: "Si la voz deja de funcionar, pida al personal que cree una sala nueva." },
    connecting: { title: "Conectando interpretación", body: "Conectando por primera vez. Espere un momento.", hint: "Hable cuando el botón se vuelva rojo." }
  },
  de: {
    statusLabels: {
      waiting_for_patient: "Warten",
      ready: "Bereit",
      staff_speaking: "Personal spricht",
      translating_to_patient: "Übersetzung",
      patient_listening: "Text angezeigt",
      patient_speaking: "Sie sprechen",
      translating_to_staff: "Übersetzung",
      staff_listening: "Text angezeigt",
      ended: "Beendet",
      error: "Fehler"
    },
    statusDescriptions: {
      waiting_for_patient: "Warten, bis der Raum geöffnet wird.",
      ready: "Tippen Sie auf das Mikrofon und sprechen Sie.",
      staff_speaking: "Das Personal spricht.",
      translating_to_patient: "Übersetzung für Sie.",
      patient_listening: "Der übersetzte Text wird angezeigt.",
      patient_speaking: "Wir hören Ihnen zu.",
      translating_to_staff: "Übersetzung für das Personal.",
      staff_listening: "Der übersetzte Text wird angezeigt.",
      ended: "Die Dolmetschsitzung ist beendet.",
      error: "Ein Verbindungsfehler ist aufgetreten."
    },
    primary: { ended: "Sitzung beendet", speaking: "Zum Beenden erneut tippen", ready: "Tippen und sprechen", waiting: "Bitte warten" },
    helper: { speaking: "Tippen Sie erneut, wenn Sie fertig sind", idle: "Bitte sprechen Sie nacheinander" },
    errors: { mic: "Das Mikrofon ist nicht verfügbar.", busy: "Die andere Person spricht. Bitte versuchen Sie es gleich erneut." },
    transcript: { title: "Letzte Verdolmetschung", empty: "Die Übersetzung der anderen Person erscheint hier.", staff: "Übersetzung des Personals", patient: "Übersetzung des Patienten" },
    end: "Dolmetschen beenden",
    backWarning: { title: "Bitte bleiben Sie während des Dolmetschens auf diesem Bildschirm.", body: "Wenn die Sprache nicht mehr funktioniert, bitten Sie das Personal, einen neuen Raum zu erstellen." },
    connecting: { title: "Dolmetschen wird verbunden", body: "Erste Verbindung wird hergestellt. Bitte warten Sie.", hint: "Sprechen Sie, wenn die Taste rot wird." }
  },
  it: {
    statusLabels: {
      waiting_for_patient: "In attesa",
      ready: "Pronto",
      staff_speaking: "Il personale sta parlando",
      translating_to_patient: "Traduzione",
      patient_listening: "Testo mostrato",
      patient_speaking: "Stai parlando",
      translating_to_staff: "Traduzione",
      staff_listening: "Testo mostrato",
      ended: "Terminato",
      error: "Errore"
    },
    statusDescriptions: {
      waiting_for_patient: "In attesa dell'apertura della stanza.",
      ready: "Tocca il microfono e parla.",
      staff_speaking: "Il personale sta parlando.",
      translating_to_patient: "Traduzione per te.",
      patient_listening: "Il testo tradotto è stato mostrato.",
      patient_speaking: "Ti stiamo ascoltando.",
      translating_to_staff: "Traduzione per il personale.",
      staff_listening: "Il testo tradotto è stato mostrato.",
      ended: "La sessione di interpretariato è terminata.",
      error: "Si è verificato un errore di connessione."
    },
    primary: { ended: "Sessione terminata", speaking: "Tocca di nuovo per finire", ready: "Tocca e parla", waiting: "Attendi" },
    helper: { speaking: "Tocca di nuovo quando hai finito", idle: "Parlate uno alla volta" },
    errors: { mic: "Il microfono non è disponibile.", busy: "L'altra persona sta parlando. Riprova tra poco." },
    transcript: { title: "Interpretariato recente", empty: "La traduzione dell'altra persona apparirà qui.", staff: "Traduzione del personale", patient: "Traduzione del paziente" },
    end: "Termina interpretariato",
    backWarning: { title: "Rimani su questa schermata durante l'interpretariato.", body: "Se la voce non funziona più, chiedi al personale di creare una nuova stanza." },
    connecting: { title: "Connessione interpretariato", body: "Prima connessione in corso. Attendi un momento.", hint: "Parla quando il pulsante diventa rosso." }
  },
  pt: {
    statusLabels: {
      waiting_for_patient: "Aguardando",
      ready: "Pronto",
      staff_speaking: "A equipe está falando",
      translating_to_patient: "Traduzindo",
      patient_listening: "Texto exibido",
      patient_speaking: "Você está falando",
      translating_to_staff: "Traduzindo",
      staff_listening: "Texto exibido",
      ended: "Encerrado",
      error: "Erro"
    },
    statusDescriptions: {
      waiting_for_patient: "Aguardando a sala abrir.",
      ready: "Toque no microfone e fale.",
      staff_speaking: "A equipe está falando.",
      translating_to_patient: "Traduzindo para você.",
      patient_listening: "O texto traduzido foi exibido.",
      patient_speaking: "Estamos ouvindo você.",
      translating_to_staff: "Traduzindo para a equipe.",
      staff_listening: "O texto traduzido foi exibido.",
      ended: "A sessão de interpretação foi encerrada.",
      error: "Ocorreu um erro de conexão."
    },
    primary: { ended: "Sessão encerrada", speaking: "Toque novamente para terminar", ready: "Toque e fale", waiting: "Aguarde" },
    helper: { speaking: "Toque novamente quando terminar", idle: "Fale uma pessoa por vez" },
    errors: { mic: "O microfone não está disponível.", busy: "A outra pessoa está falando. Tente novamente em instantes." },
    transcript: { title: "Interpretação recente", empty: "A tradução da outra pessoa aparecerá aqui.", staff: "Tradução da equipe", patient: "Tradução do paciente" },
    end: "Encerrar interpretação",
    backWarning: { title: "Permaneça nesta tela durante a interpretação.", body: "Se a voz parar de funcionar, peça à equipe para criar uma nova sala." },
    connecting: { title: "Conectando interpretação", body: "Conectando pela primeira vez. Aguarde um momento.", hint: "Fale quando o botão ficar vermelho." }
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
  const [textInput, setTextInput] = useState("");
  const [textSubmitting, setTextSubmitting] = useState(false);
  const [activeExampleCategory, setActiveExampleCategory] = useState<ConsultationExampleCategory>("reservation");
  const [backWarning, setBackWarning] = useState(false);
  const [audioPlaybackEnabled, setAudioPlaybackEnabled] = useState(false);
  const [procedureActive, setProcedureActive] = useState(false);
  const [procedureBusy, setProcedureBusy] = useState(false);
  const [wakeLockStatus, setWakeLockStatus] = useState("");
  const [hardwareInputStatus, setHardwareInputStatus] = useState("키보드 입력 대기");
  const [ttsStatus, setTtsStatus] = useState(`TTS ${TTS_DEBUG_VERSION}`);
  const [ttsSetupHint, setTtsSetupHint] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const roomRootRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLElement | null>(null);
  const hardwareCaptureRef = useRef<HTMLInputElement | null>(null);
  const realtimeClientRef = useRef<OpenAIRealtimeClient | null>(null);
  const realtimePreconnectStartedRef = useRef(false);
  const isComposingTextRef = useRef(false);
  const spokenMessageIdsRef = useRef(new Set<string>());
  const procedureActiveRef = useRef(false);
  const pressedHardwareKeysRef = useRef(new Set<string>());
  const lastHardwareToggleAtRef = useRef(0);
  const roomRef = useRef(initialRoom);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const speechQueueRef = useRef(Promise.resolve());
  const startSpeakingRef = useRef<() => Promise<void>>(async () => undefined);
  const stopSpeakingRef = useRef<() => Promise<void>>(async () => undefined);
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
  const currentSpeechLanguage = role === "staff" ? speechLanguageByPatientLanguage.ko : speechLanguageByPatientLanguage[room.patientLanguage];
  const currentSpeechLanguageLabel = role === "staff" ? "한국어" : languageLabels[room.patientLanguage].native;
  const patientTextCopy = consultationTextCopy[room.patientLanguage];
  const deliveryStatusCopy = role === "staff" ? { sending: "전송 중", failed: "전송 실패" } : consultationDeliveryStatusCopy[room.patientLanguage];
  const patientExamples = consultationExampleCategories[room.patientLanguage];
  const consultationStatusDescription = role === "staff" ? "상담 내용을 텍스트로 입력해 번역을 보내세요." : patientTextCopy.placeholder;
  const chatMessages = [...messages].reverse();
  const staffFollowUpSuggestionSet = getStaffFollowUpSuggestionSet(latestMessage);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const title = useMemo(() => {
    const language = languageLabels[room.patientLanguage];
    if (isProcedureMode) return role === "staff" ? `${language.ko} 시술 통역` : `${language.native} Procedure`;
    return role === "staff" ? `${language.ko} 통역` : `${language.native} Interpretation`;
  }, [isProcedureMode, role, room.patientLanguage]);

  useEffect(() => {
    if (isProcedureMode) return;
    const chatScroll = chatScrollRef.current;
    if (!chatScroll) return;

    const frame = window.requestAnimationFrame(() => {
      chatScroll.scrollTo({
        top: chatScroll.scrollHeight,
        behavior: chatMessages.length > 1 ? "smooth" : "auto"
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chatMessages.length, isProcedureMode, textSubmitting]);

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
        onFirstOutputDelta: () => {
          if (isProcedureMode) {
            void transition(role === "staff" ? "patient_listening" : "staff_listening");
          }
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
  }, [isProcedureMode, role, room.id, roomToken, transition]);

  const appendMessage = useCallback((message: TranslationMessage) => {
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) return current;
      return [message, ...current].slice(0, 50);
    });
  }, []);

  const updateMessageDeliveryStatus = useCallback((messageId: string, deliveryStatus?: TranslationMessage["deliveryStatus"]) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;
        if (!deliveryStatus) return { id: message.id, speaker: message.speaker, text: message.text };
        return { ...message, deliveryStatus };
      })
    );
  }, []);

  const stopPlayback = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

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

  const playBrowserTranslatedSpeech = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      setError("This browser does not support device TTS.");
      setTtsStatus(`Device TTS unavailable / ${TTS_DEBUG_VERSION}`);
      return;
    }

    const lang = currentSpeechLanguage;
    const voice = findBrowserVoice(lang);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    if (voice) utterance.voice = voice;

    utterance.onerror = () => {
      setError(`${languageLabels[room.patientLanguage].native} TTS voice could not be played on this device.`);
      setTtsStatus(`Device TTS error / ${lang} / ${TTS_DEBUG_VERSION}`);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setTtsStatus(
      voice
        ? `Device TTS / ${lang} / ${voice.name} / ${TTS_DEBUG_VERSION}`
        : `Device TTS / ${lang} / no matching voice listed / ${TTS_DEBUG_VERSION}`
    );
  }, [currentSpeechLanguage, findBrowserVoice, room.patientLanguage]);

  const playQueuedTranslatedSpeech = useCallback((message: TranslationMessage) => {
    speechQueueRef.current = speechQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        playBrowserTranslatedSpeech(message.text);
      });
  }, [playBrowserTranslatedSpeech]);

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
      if (message.speaker !== role) appendMessage(message);
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
    playQueuedTranslatedSpeech(latestMessage);
  }, [audioPlaybackEnabled, latestMessage, playQueuedTranslatedSpeech]);

  useEffect(() => {
    if (!isProcedureMode) return;
    setAudioPlaybackEnabled(true);
    void requestScreenWakeLock();
    return () => {
      void releaseScreenWakeLock();
      stopPlayback();
    };
  }, [isProcedureMode, stopPlayback]);

  useEffect(() => {
    const shouldKeepAwake = isProcedureMode || procedureActive;
    if (!shouldKeepAwake) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void requestScreenWakeLock();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isProcedureMode, procedureActive]);

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
    if (!isProcedureMode || room.status === "ended") return;

    roomRootRef.current?.focus();
    hardwareCaptureRef.current?.focus({ preventScroll: true });

    const isArrowUpKey = (event: KeyboardEvent) =>
      event.code === "ArrowUp" ||
      event.key === "ArrowUp" ||
      event.key === "Up" ||
      event.code === "PageUp" ||
      event.key === "PageUp" ||
      event.keyCode === 33 ||
      event.keyCode === 38;

    const isPttKey = (event: KeyboardEvent) =>
      event.code === "Space" ||
      event.key === " " ||
      event.key === "Spacebar" ||
      event.code === "Enter" ||
      event.key === "Enter" ||
      event.code === "NumpadEnter" ||
      event.code === "MediaPlayPause" ||
      event.key === "MediaPlayPause" ||
      event.code === "PageUp" ||
      event.key === "PageUp" ||
      event.key === "Up" ||
      event.code === "ArrowDown" ||
      event.code === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.keyCode === 13 ||
      event.keyCode === 32 ||
      event.keyCode === 38 ||
      event.keyCode === 40;

    const keyId = (event: KeyboardEvent) => `${event.code || event.key || event.keyCode}`;
    const pressedHardwareKeys = pressedHardwareKeysRef.current;

    const toggleFromHardwareInput = (event: KeyboardEvent, source: "keydown" | "keypress" | "keyup") => {
      setHardwareInputStatus(`입력 감지: ${event.code || event.key || event.keyCode}`);
      if (!isPttKey(event)) return;

      const id = keyId(event);
      if (source === "keydown" && (event.repeat || pressedHardwareKeys.has(id))) return;
      pressedHardwareKeys.add(id);

      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (now - lastHardwareToggleAtRef.current < 350) return;
      lastHardwareToggleAtRef.current = now;

      setHardwareInputStatus(`${isArrowUpKey(event) ? "↑" : "키보드"} 입력 적용됨 (${source})`);
      if (busy && !isSpeaking) return;
      if (!isSpeaking && !micEnabled) return;
      if (isSpeaking) void stopSpeakingRef.current();
      else void startSpeakingRef.current();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      toggleFromHardwareInput(event, "keydown");
    };

    const handleKeyPress = (event: KeyboardEvent) => {
      toggleFromHardwareInput(event, "keypress");
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      toggleFromHardwareInput(event, "keyup");
      pressedHardwareKeys.delete(keyId(event));
    };

    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keypress", handleKeyPress, true);
    document.addEventListener("keypress", handleKeyPress, true);
    window.addEventListener("keyup", handleKeyUp, true);
    document.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keypress", handleKeyPress, true);
      document.removeEventListener("keypress", handleKeyPress, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      document.removeEventListener("keyup", handleKeyUp, true);
      pressedHardwareKeys.clear();
    };
  }, [busy, isProcedureMode, isSpeaking, micEnabled, room.status]);

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

  async function submitTextMessage(textOverride?: string) {
    const sourceText = (textOverride ?? textInput).trim();
    if (!sourceText || room.status !== "ready" || textSubmitting) return;

    markActivity();
    setError("");
    setRealtimeStatus("");
    setTextSubmitting(true);

    const translatingStatus = role === "staff" ? "translating_to_patient" : "translating_to_staff";
    const readyRoom = { ...room, status: "ready" as const };
    const messageId = `${role}-text-${Date.now()}`;
    const localMessage = {
      id: `${messageId}-local`,
      speaker: role,
      text: sourceText,
      deliveryStatus: "sending"
    } satisfies TranslationMessage;

    try {
      const turnAcquired = await transition(translatingStatus);
      if (!turnAcquired) throw new Error(copy.errors.busy);
      appendMessage(localMessage);

      const response = await fetch("/api/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          role,
          roomToken,
          patientLanguage: room.patientLanguage,
          text: sourceText
        })
      });
      const data = (await response.json().catch(() => null)) as { translatedText?: string; error?: string } | null;
      if (!response.ok || !data?.translatedText) {
        throw new Error(data?.error ?? "Text translation failed.");
      }

      const message = {
        id: messageId,
        speaker: role,
        text: data.translatedText
      } satisfies RealtimeTranslationMessage;

      const delivered = await broadcastTranslationMessage(room.id, message);
      if (!delivered) {
        throw new Error(role === "staff" ? "메시지를 전송하지 못했습니다. 네트워크 연결을 확인해주세요." : deliveryStatusCopy.failed);
      }
      updateMessageDeliveryStatus(localMessage.id);
      if (!textOverride) setTextInput("");
    } catch (caught) {
      updateMessageDeliveryStatus(localMessage.id, "failed");
      setError(caught instanceof Error ? caught.message : "Text translation failed.");
    } finally {
      setRoom(readyRoom);
      void broadcastRoomUpdate(readyRoom);
      await transition("ready");
      setTextSubmitting(false);
    }
  }

  function handleTextInputKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (isComposingTextRef.current || event.nativeEvent.isComposing) return;

    event.preventDefault();
    void submitTextMessage();
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

  function openDeviceTtsSettings() {
    setTtsStatus(`Android TTS settings requested / ${currentSpeechLanguage} / ${TTS_DEBUG_VERSION}`);
    setTtsSetupHint(
      `브라우저가 설정 앱 열기를 막을 수 있습니다. 안 열리면 Android 설정 > 일반 관리 > 글자 읽어주기 또는 텍스트 음성 변환 > ${currentSpeechLanguageLabel} 음성을 설치해주세요.`
    );
    window.location.href = "intent:#Intent;action=android.settings.TTS_SETTINGS;package=com.android.settings;end";
  }

  function openGoogleTtsInstall() {
    setTtsStatus(`Open Google Speech Services / ${currentSpeechLanguage} / ${TTS_DEBUG_VERSION}`);
    setTtsSetupHint(
      `스토어가 열리면 Speech Services by Google을 설치 또는 업데이트한 뒤, Android TTS 설정에서 ${currentSpeechLanguageLabel} 음성 데이터를 선택해주세요.`
    );
    window.location.href = GOOGLE_TTS_MARKET_URL;
    window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.href = GOOGLE_TTS_WEB_URL;
    }, 700);
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
          const normalizedText = normalizeClinicTranslation(translatedText, room.patientLanguage);
          const message = {
            id: `staff-procedure-${Date.now()}`,
            speaker: "staff",
            text: normalizedText
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
      if (isProcedureMode) stopPlayback();
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
      const translatedText = await realtimeClientRef.current?.stopTurnAndTranslate({
        quietMs: isProcedureMode ? PROCEDURE_TRANSLATION_QUIET_MS : CONSULTATION_TRANSLATION_QUIET_MS,
        maxMs: isProcedureMode ? PROCEDURE_TRANSLATION_MAX_MS : CONSULTATION_TRANSLATION_MAX_MS
      });
      if (!translatedText) throw new Error("No translated text was returned.");
      const normalizedText = normalizeClinicTranslation(translatedText, role === "staff" ? room.patientLanguage : "ko");

      const message = {
        id: `${role}-${Date.now()}`,
        speaker: role,
        text: normalizedText
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

  useEffect(() => {
    startSpeakingRef.current = startSpeaking;
    stopSpeakingRef.current = stopSpeaking;
  });

  if (!isProcedureMode) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] flex-col overflow-hidden rounded-lg bg-white shadow-soft md:min-h-[760px]">
        <header className="shrink-0 border-b border-line bg-white px-4 py-4 md:px-6">
          {backWarning ? (
            <section className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-bold text-amber-800">{copy.backWarning.title}</p>
              <button
                type="button"
                onClick={() => setBackWarning(false)}
                className="mt-2 h-9 rounded-lg bg-white px-3 text-sm font-bold text-amber-800 shadow-sm"
              >
                OK
              </button>
            </section>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-trust">{room.hospital?.name ?? "Clinic Voice Room"}</p>
              <h1 className="mt-1 text-lg font-bold text-ink">{title}</h1>
            </div>
            <span className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${statusTone.tone}`}>
              <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
              {copy.statusLabels[room.status]}
            </span>
          </div>
          <div className="mt-3 flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-100 text-sm font-bold text-mint">
              AI
            </div>
            <div>
              <p className="text-sm font-bold text-ink">{role === "staff" ? "텍스트 상담방이 시작되었습니다." : "AI translation consultation has started."}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{consultationStatusDescription}</p>
            </div>
          </div>
        </header>

        <section ref={chatScrollRef} className="flex-1 overflow-y-auto bg-mist px-4 py-4 md:px-6" aria-live="polite">
          {chatMessages.length ? (
            <div className="space-y-3">
              {chatMessages.map((message) => {
                const mine = message.speaker === role;
                const failed = message.deliveryStatus === "failed";
                return (
                  <article key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    {!mine ? (
                      <div className="mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-100 text-xs font-bold text-mint">
                        {message.speaker === "staff" ? "S" : "P"}
                      </div>
                    ) : null}
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm font-semibold leading-6 shadow-sm md:max-w-[70%] md:text-base ${
                        mine
                          ? failed
                            ? "rounded-br-md bg-rose-500 text-white"
                            : "rounded-br-md bg-trust text-white"
                          : "rounded-bl-md bg-white text-ink"
                      }`}
                    >
                      {message.text}
                      {message.deliveryStatus ? (
                        <span className={`mt-1 block text-[11px] font-bold ${mine ? "text-white/80" : "text-slate-400"}`}>
                          {message.deliveryStatus === "sending" ? deliveryStatusCopy.sending : deliveryStatusCopy.failed}
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full min-h-[260px] items-center justify-center text-center">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-100 text-lg font-bold text-mint">AI</div>
                <p className="mt-4 text-base font-bold text-ink">{role === "staff" ? "고객의 메시지가 여기에 표시됩니다." : patientTextCopy.title}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{consultationStatusDescription}</p>
              </div>
            </div>
          )}
        </section>

        <footer className="shrink-0 border-t border-line bg-white p-3 md:p-4">
          {role === "patient" ? (
            <div className="mb-3 rounded-lg bg-blue-50 p-3">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(patientExamples) as ConsultationExampleCategory[]).map((category) => {
                  const active = category === activeExampleCategory;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveExampleCategory(category)}
                      className={`min-h-10 rounded-lg px-2 text-xs font-bold transition md:text-sm ${
                        active ? "bg-trust text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {patientExamples[category].label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {patientExamples[activeExampleCategory].examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => void submitTextMessage(example)}
                    disabled={room.status !== "ready" || textSubmitting}
                    className="min-w-[220px] rounded-lg bg-white px-3 py-2 text-left text-sm font-bold leading-5 text-ink shadow-sm transition hover:bg-slate-50 disabled:opacity-50 md:min-w-[260px]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : latestMessage?.speaker === "patient" ? (
            <div className="mb-3 rounded-lg bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-500">다음 질문 예시</p>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-trust shadow-sm">
                  {staffFollowUpSuggestionSet.label}
                </span>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {staffFollowUpSuggestionSet.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setTextInput(suggestion)}
                    className="min-w-[220px] rounded-lg bg-white px-3 py-2 text-left text-sm font-bold leading-5 text-ink shadow-sm transition hover:bg-slate-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-end gap-2 rounded-2xl bg-slate-50 p-2">
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
              placeholder={role === "staff" ? "상담 내용을 입력하세요." : patientTextCopy.placeholder}
              disabled={room.status === "ended" || textSubmitting}
              rows={1}
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-base font-semibold leading-7 text-ink outline-none disabled:opacity-60"
            />
            {role === "patient" ? (
              <button
                type="button"
                onClick={isSpeaking ? stopSpeaking : startSpeaking}
                disabled={room.status === "ended" || (busy && !isSpeaking) || (!micEnabled && !isSpeaking)}
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition disabled:opacity-50 ${
                  isSpeaking ? "bg-coral text-white" : "bg-white text-trust"
                }`}
                aria-label={isSpeaking ? copy.primary.speaking : patientTextCopy.voice}
                title={isSpeaking ? copy.primary.speaking : patientTextCopy.voice}
              >
                {busy && !isSpeaking ? <Loader2 size={18} className="animate-spin" /> : <Mic size={19} />}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void submitTextMessage()}
              disabled={!textInput.trim() || room.status !== "ready" || textSubmitting}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-trust text-white transition hover:bg-blue-600 disabled:opacity-50"
              aria-label={role === "staff" ? "번역 보내기" : patientTextCopy.submit}
              title={role === "staff" ? "번역 보내기" : patientTextCopy.submit}
            >
              {textSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={19} />}
            </button>
          </div>
          {realtimeStatus ? <p className="mt-2 text-xs font-bold text-trust">{realtimeStatus}</p> : null}
          {error ? <p className="mt-2 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
          {role === "staff" ? (
            <button
              onClick={endRoom}
              disabled={busy || room.status === "ended"}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-rose-50 px-4 text-sm font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
            >
              <PhoneOff size={17} />
              {copy.end}
            </button>
          ) : null}
        </footer>
      </div>
    );
  }

  return (
    <div
      ref={roomRootRef}
      className="space-y-4 outline-none"
      tabIndex={-1}
      onPointerDown={() => {
        if (!isProcedureMode) return;
        roomRootRef.current?.focus();
        hardwareCaptureRef.current?.focus({ preventScroll: true });
      }}
    >
      {isProcedureMode ? (
        <input
          ref={hardwareCaptureRef}
          aria-hidden="true"
          autoComplete="off"
          inputMode="none"
          readOnly
          tabIndex={-1}
          className="fixed left-0 top-0 h-px w-px opacity-0"
        />
      ) : null}
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
            <MessageSquareText size={18} className="mt-0.5 shrink-0 text-trust" />
            {room.status === "ready" ? consultationStatusDescription : copy.statusDescriptions[room.status]}
          </div>
        ) : null}
      </header>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        {!isProcedureMode ? (
          <div className="flex items-center gap-2">
            <MessageSquareText size={19} className="text-trust" />
            <h2 className="text-base font-bold text-ink">{copy.transcript.title}</h2>
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

      {!isProcedureMode ? (
        <section className="rounded-lg bg-white p-5 shadow-soft">
          <div className="flex items-center gap-2">
            <MessageSquareText size={19} className="text-trust" />
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-ink">{role === "staff" ? "텍스트로 상담하기" : patientTextCopy.title}</h2>
            </div>
          </div>
          {role === "patient" ? (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(patientExamples) as ConsultationExampleCategory[]).map((category) => {
                  const active = category === activeExampleCategory;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveExampleCategory(category)}
                      className={`min-h-11 rounded-lg px-2 text-sm font-bold transition ${
                        active ? "bg-trust text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {patientExamples[category].label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid gap-2">
                {patientExamples[activeExampleCategory].examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => void submitTextMessage(example)}
                    disabled={room.status !== "ready" || textSubmitting}
                    className="min-h-12 rounded-lg bg-white px-3 py-3 text-left text-sm font-bold leading-6 text-ink transition hover:bg-slate-50 disabled:opacity-50 md:text-base"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <textarea
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
            placeholder={role === "staff" ? "상담 내용을 한국어로 입력하세요." : patientTextCopy.placeholder}
            disabled={room.status === "ended" || textSubmitting}
            className="mt-4 min-h-[128px] w-full resize-none rounded-lg border border-line bg-slate-50 px-4 py-3 text-base font-semibold leading-7 text-ink outline-none transition focus:border-trust focus:bg-white disabled:opacity-60 md:min-h-[180px] md:text-lg md:leading-8"
          />
          <button
            type="button"
            onClick={() => void submitTextMessage()}
            disabled={!textInput.trim() || room.status !== "ready" || textSubmitting}
            className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-trust px-4 text-base font-bold text-white transition hover:bg-blue-600 disabled:opacity-50 md:h-16 md:text-lg"
          >
            {textSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={19} />}
            {role === "staff" ? "번역 보내기" : patientTextCopy.submit}
          </button>
          {realtimeStatus ? <p className="mt-3 text-xs font-bold text-trust">{realtimeStatus}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        </section>
      ) : null}

      {isProcedureMode ? (
        <section className="rounded-lg bg-white p-5 text-center shadow-soft">
          <div className="mx-auto mb-5 max-w-sm">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-trust">2-device procedure</p>
            <h2 className="mt-2 text-2xl font-bold text-ink">{role === "staff" ? "Doctor device" : "Patient device"}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              {role === "staff" ? "Press, speak Korean, then press again." : "Press anytime to answer. The phone reads translated text aloud."}
            </p>
          </div>
          <button
            type="button"
            disabled={room.status === "ended" || (busy && !isSpeaking) || (!micEnabled && !isSpeaking)}
            onClick={isSpeaking ? stopSpeaking : startSpeaking}
            className={`tap-highlight-none mx-auto grid h-44 w-44 place-items-center rounded-full text-white shadow-soft transition active:scale-[0.98] disabled:bg-slate-300 disabled:opacity-80 md:h-52 md:w-52 ${
              isSpeaking ? "bg-coral" : micEnabled ? "bg-ink" : "bg-slate-300"
            }`}
            aria-label={isSpeaking ? copy.primary.speaking : copy.primary.ready}
          >
            {busy && !isSpeaking ? <Loader2 size={44} className="animate-spin" /> : <Mic size={56} />}
          </button>
          <p className="mt-4 text-xl font-bold text-ink">
            {room.status === "ended" ? copy.primary.ended : isSpeaking ? copy.primary.speaking : micEnabled ? copy.primary.ready : copy.primary.waiting}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-500">↑ key toggles this button. Space / Enter are also supported.</p>
          <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{hardwareInputStatus}</p>
          <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-trust">{ttsStatus}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={openGoogleTtsInstall}
              className="h-11 rounded-lg bg-trust px-4 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              TTS 앱 설치/업데이트
            </button>
            <button
              type="button"
              onClick={openDeviceTtsSettings}
              className="h-11 rounded-lg bg-slate-100 px-4 text-sm font-bold text-ink transition hover:bg-slate-200"
            >
              {currentSpeechLanguageLabel} TTS 설정 열기
            </button>
          </div>
          {ttsSetupHint ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-3 text-left text-xs font-bold leading-5 text-amber-800">{ttsSetupHint}</p> : null}
          {wakeLockStatus ? <p className="mt-3 text-xs font-bold text-trust">{wakeLockStatus}</p> : null}
          {realtimeStatus ? <p className="mt-2 text-xs font-bold text-trust">{realtimeStatus}</p> : null}
          <p className="mt-2 text-sm font-semibold text-slate-500">{isSpeaking ? copy.helper.speaking : copy.helper.idle}</p>
          <div className="hidden" aria-hidden="true">
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
          </div>
          {error ? <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
        </section>
      ) : role === "patient" ? (
        <section className="rounded-lg bg-white p-5 text-center shadow-soft">
          <p className="mb-4 text-sm font-bold text-slate-500">{patientTextCopy.voice}</p>
          <button
            type="button"
            disabled={room.status === "ended" || (busy && !isSpeaking) || (!micEnabled && !isSpeaking)}
            onClick={isSpeaking ? stopSpeaking : startSpeaking}
            className={`tap-highlight-none mx-auto grid h-40 w-40 place-items-center rounded-full text-white shadow-soft transition active:scale-[0.98] md:h-48 md:w-48 ${
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
      ) : null}

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
