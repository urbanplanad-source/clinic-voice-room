"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, PhoneOff } from "lucide-react";
import { languageLabels, type ParticipantRole, type PatientLanguage } from "@/lib/languages";
import { OpenAIRealtimeClient } from "@/lib/openai-realtime-client";
import { normalizeClinicTranslation } from "@/lib/clinic-glossary";
import { isMicEnabled, type RoomStatus } from "@/lib/room-state";
import { ConsultationChatRoom } from "./ConsultationChatRoom";
import {
  broadcastRoomUpdate,
  broadcastTranslationMessage,
  subscribeToRoomUpdates,
  subscribeToTranslationMessages,
  type RealtimeTranslationMessage
} from "@/lib/supabase-realtime";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const PROCEDURE_TRANSLATION_QUIET_MS = 700;
const PROCEDURE_TRANSLATION_MAX_MS = 5500;
const TTS_DEBUG_VERSION = "device-tts-only-2026-05-19.1";
const GOOGLE_TTS_MARKET_URL = "market://details?id=com.google.android.tts";
const GOOGLE_TTS_WEB_URL = "https://play.google.com/store/apps/details?id=com.google.android.tts";

const speechLanguageByPatientLanguage: Record<PatientLanguage | "ko", string> = {
  ko: "ko-KR",
  zh: "zh-CN",
  zh_tw: "zh-TW",
  ja: "ja-JP",
  en: "en-US",
  th: "th-TH",
  ms: "ms-MY",
  mn: "mn-MN",
  ru: "ru-RU",
  vi: "vi-VN",
  id: "id-ID",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT"
};

const procedureIntroCopies: Record<PatientLanguage, string> = {
  zh: "我们正在准备治疗。如果您有不舒服或想说的话，请按屏幕上的按钮。按钮变成红色后请说话，说完后再按一次按钮结束。",
  zh_tw: "我們正在準備療程。如果您有不舒服或想說的話，請按螢幕上的按鈕。按鈕變成紅色後請說話，說完後再按一次按鈕結束。",
  ja: "施術の準備をしています。ご不便なことや伝えたいことがあれば、画面のボタンを押してください。ボタンが赤くなったら話し、終わったらもう一度ボタンを押してください。",
  en: "We are preparing for your procedure. If you feel uncomfortable or want to say something, please press the button on the screen. When the button turns red, speak, then press it again when you are finished.",
  th: "เรากำลังเตรียมทำหัตถการ หากรู้สึกไม่สบายหรือมีเรื่องที่อยากบอก กรุณากดปุ่มบนหน้าจอ เมื่อปุ่มเปลี่ยนเป็นสีแดงให้พูด แล้วกดปุ่มอีกครั้งเมื่อพูดจบ",
  ms: "Kami sedang menyediakan prosedur anda. Jika anda rasa tidak selesa atau ingin berkata sesuatu, sila tekan butang pada skrin. Apabila butang menjadi merah, bercakaplah, kemudian tekan sekali lagi apabila selesai.",
  mn: "Ажилбарт бэлдэж байна. Танд таагүй зүйл байвал эсвэл хэлэх зүйл байвал дэлгэц дээрх товчийг дарна уу. Товч улаан болмогц яриад, дууссаны дараа дахин дарна уу.",
  ru: "Мы готовимся к процедуре. Если вам неудобно или вы хотите что-то сказать, нажмите кнопку на экране. Когда кнопка станет красной, говорите, а когда закончите, нажмите кнопку еще раз.",
  vi: "Chúng tôi đang chuẩn bị cho liệu trình. Nếu quý khách thấy khó chịu hoặc muốn nói điều gì, vui lòng nhấn nút trên màn hình. Khi nút chuyển sang màu đỏ, hãy nói, rồi nhấn lại nút khi đã nói xong.",
  id: "Kami sedang menyiapkan prosedur Anda. Jika Anda merasa tidak nyaman atau ingin mengatakan sesuatu, tekan tombol di layar. Saat tombol berubah merah, silakan bicara, lalu tekan lagi setelah selesai.",
  fr: "Nous préparons votre intervention. Si vous ressentez une gêne ou souhaitez dire quelque chose, appuyez sur le bouton à l'écran. Quand le bouton devient rouge, parlez, puis appuyez de nouveau lorsque vous avez terminé.",
  es: "Estamos preparando el procedimiento. Si siente alguna molestia o quiere decir algo, pulse el botón en la pantalla. Cuando el botón se ponga rojo, hable y vuelva a pulsarlo cuando haya terminado.",
  de: "Wir bereiten die Behandlung vor. Wenn Sie sich unwohl fühlen oder etwas sagen möchten, drücken Sie bitte die Taste auf dem Bildschirm. Wenn die Taste rot wird, sprechen Sie, und drücken Sie sie erneut, wenn Sie fertig sind.",
  it: "Stiamo preparando la procedura. Se avverte fastidio o vuole dire qualcosa, prema il pulsante sullo schermo. Quando il pulsante diventa rosso, parli, poi lo prema di nuovo quando ha finito.",
  pt: "Estamos preparando o procedimento. Se sentir algum desconforto ou quiser dizer algo, toque no botão na tela. Quando o botão ficar vermelho, fale e toque novamente quando terminar."
};

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
  patientJoinedAt?: string | null;
  hospital?: { name: string };
  usageSession?: { totalRoomSeconds: number; roomStartedAt: string; roomEndedAt?: string | null } | null;
};

type VoiceRoomProps = {
  initialRoom: RoomSnapshot;
  role: ParticipantRole;
  roomToken?: string;
  roomMode?: RoomMode;
};

type TranslationMessage = {
  id: string;
  speaker: ParticipantRole;
  sourceText?: string;
  text: string;
  targetLanguage?: PatientLanguage | "ko";
  createdAt?: string;
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
  zh_tw: {
    statusLabels: {
      waiting_for_patient: "等待",
      ready: "準備好了",
      staff_speaking: "工作人員正在說話",
      translating_to_patient: "正在翻譯",
      patient_listening: "已顯示翻譯",
      patient_speaking: "您正在說話",
      translating_to_staff: "正在翻譯",
      staff_listening: "已顯示翻譯",
      ended: "已結束",
      error: "錯誤"
    },
    statusDescriptions: {
      waiting_for_patient: "正在等待翻譯室開啟。",
      ready: "請點擊麥克風並說話。",
      staff_speaking: "工作人員正在說話。",
      translating_to_patient: "正在為您翻譯。",
      patient_listening: "翻譯內容已顯示。",
      patient_speaking: "正在聽您說話。",
      translating_to_staff: "正在為工作人員翻譯。",
      staff_listening: "翻譯內容已顯示。",
      ended: "本次翻譯已結束。",
      error: "發生連線錯誤。"
    },
    primary: { ended: "會話已結束", speaking: "再次點擊結束", ready: "點擊並說話", waiting: "請稍候" },
    helper: { speaking: "說完後請再次點擊", idle: "請一次一人說話" },
    errors: { mic: "無法使用麥克風。", busy: "對方正在說話。請稍後再試。" },
    transcript: { title: "最近翻譯", empty: "對方的翻譯文字將顯示在這裡。", staff: "工作人員說話翻譯", patient: "患者說話翻譯" },
    end: "結束翻譯",
    backWarning: { title: "翻譯過程中請停留在此頁面。", body: "如果語音無法繼續使用，請讓工作人員建立新的房間。" },
    connecting: { title: "正在連接即時翻譯", body: "首次連線中，請稍候。", hint: "按鈕變紅後即可說話。" }
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
  th: {
    statusLabels: {
      waiting_for_patient: "รอ",
      ready: "พร้อม",
      staff_speaking: "เจ้าหน้าที่กำลังพูด",
      translating_to_patient: "กำลังแปล",
      patient_listening: "แสดงข้อความแล้ว",
      patient_speaking: "คุณกำลังพูด",
      translating_to_staff: "กำลังแปล",
      staff_listening: "แสดงข้อความแล้ว",
      ended: "สิ้นสุด",
      error: "ข้อผิดพลาด"
    },
    statusDescriptions: {
      waiting_for_patient: "กำลังรอให้ห้องล่ามเปิด",
      ready: "แตะไมโครโฟนแล้วพูด",
      staff_speaking: "เจ้าหน้าที่กำลังพูด",
      translating_to_patient: "กำลังแปลให้คุณ",
      patient_listening: "แสดงข้อความแปลแล้ว",
      patient_speaking: "กำลังฟังคุณพูด",
      translating_to_staff: "กำลังแปลให้เจ้าหน้าที่",
      staff_listening: "แสดงข้อความแปลแล้ว",
      ended: "สิ้นสุดเซสชันล่ามแล้ว",
      error: "เกิดข้อผิดพลาดในการเชื่อมต่อ"
    },
    primary: { ended: "เซสชันสิ้นสุด", speaking: "แตะอีกครั้งเพื่อจบ", ready: "แตะแล้วพูด", waiting: "กรุณารอสักครู่" },
    helper: { speaking: "พูดจบแล้วแตะอีกครั้ง", idle: "กรุณาพูดทีละคน" },
    errors: { mic: "ไม่สามารถใช้ไมโครโฟนได้", busy: "อีกฝ่ายกำลังพูด กรุณาลองใหม่อีกครั้ง" },
    transcript: { title: "คำแปลล่าสุด", empty: "ข้อความแปลของอีกฝ่ายจะแสดงที่นี่", staff: "แปลคำพูดเจ้าหน้าที่", patient: "แปลคำพูดผู้ป่วย" },
    end: "จบการล่าม",
    backWarning: { title: "กรุณาอยู่ที่หน้าจอนี้ระหว่างการล่าม", body: "หากเสียงใช้ไม่ได้ กรุณาขอให้เจ้าหน้าที่สร้างห้องใหม่" },
    connecting: { title: "กำลังเชื่อมต่อล่ามแบบเรียลไทม์", body: "กำลังเชื่อมต่อครั้งแรก กรุณารอสักครู่", hint: "กรุณาพูดเมื่อปุ่มเปลี่ยนเป็นสีแดง" }
  },
  ms: {
    statusLabels: {
      waiting_for_patient: "Menunggu",
      ready: "Sedia",
      staff_speaking: "Staf sedang bercakap",
      translating_to_patient: "Menterjemah",
      patient_listening: "Teks dipaparkan",
      patient_speaking: "Anda sedang bercakap",
      translating_to_staff: "Menterjemah",
      staff_listening: "Teks dipaparkan",
      ended: "Tamat",
      error: "Ralat"
    },
    statusDescriptions: {
      waiting_for_patient: "Menunggu bilik interpretasi dibuka.",
      ready: "Ketik mikrofon dan bercakap.",
      staff_speaking: "Staf sedang bercakap.",
      translating_to_patient: "Menterjemah untuk anda.",
      patient_listening: "Teks terjemahan telah dipaparkan.",
      patient_speaking: "Sedang mendengar anda.",
      translating_to_staff: "Menterjemah untuk staf.",
      staff_listening: "Teks terjemahan telah dipaparkan.",
      ended: "Sesi interpretasi telah tamat.",
      error: "Ralat sambungan berlaku."
    },
    primary: { ended: "Sesi tamat", speaking: "Ketik lagi untuk tamat", ready: "Ketik dan bercakap", waiting: "Sila tunggu" },
    helper: { speaking: "Ketik lagi selepas selesai bercakap", idle: "Sila bercakap seorang demi seorang" },
    errors: { mic: "Mikrofon tidak tersedia.", busy: "Orang lain sedang bercakap. Cuba lagi sebentar lagi." },
    transcript: { title: "Interpretasi terkini", empty: "Terjemahan orang lain akan muncul di sini.", staff: "Terjemahan ucapan staf", patient: "Terjemahan ucapan pesakit" },
    end: "Tamatkan interpretasi",
    backWarning: { title: "Sila kekal di skrin ini semasa interpretasi.", body: "Jika suara tidak berfungsi lagi, minta staf membuat bilik baharu." },
    connecting: { title: "Menyambung interpretasi langsung", body: "Sambungan pertama sedang dibuat. Sila tunggu sebentar.", hint: "Sila bercakap apabila butang bertukar merah." }
  },
  mn: {
    statusLabels: {
      waiting_for_patient: "Хүлээж байна",
      ready: "Бэлэн",
      staff_speaking: "Ажилтан ярьж байна",
      translating_to_patient: "Орчуулж байна",
      patient_listening: "Текст харагдлаа",
      patient_speaking: "Та ярьж байна",
      translating_to_staff: "Орчуулж байна",
      staff_listening: "Текст харагдлаа",
      ended: "Дууссан",
      error: "Алдаа"
    },
    statusDescriptions: {
      waiting_for_patient: "Орчуулгын өрөө нээгдэхийг хүлээж байна.",
      ready: "Микрофон дээр дараад ярина уу.",
      staff_speaking: "Ажилтан ярьж байна.",
      translating_to_patient: "Танд зориулж орчуулж байна.",
      patient_listening: "Орчуулсан текст харагдлаа.",
      patient_speaking: "Таны яриаг сонсож байна.",
      translating_to_staff: "Ажилтанд зориулж орчуулж байна.",
      staff_listening: "Орчуулсан текст харагдлаа.",
      ended: "Орчуулгын сеанс дууссан.",
      error: "Холболтын алдаа гарлаа."
    },
    primary: { ended: "Сеанс дууссан", speaking: "Дахин дарж дуусгах", ready: "Дарж ярих", waiting: "Түр хүлээнэ үү" },
    helper: { speaking: "Ярьж дуусаад дахин дарна уу", idle: "Нэг нэгээрээ ярина уу" },
    errors: { mic: "Микрофон ашиглах боломжгүй.", busy: "Нөгөө хүн ярьж байна. Түр хүлээгээд дахин оролдоно уу." },
    transcript: { title: "Сүүлийн орчуулга", empty: "Нөгөө хүний орчуулсан текст энд гарна.", staff: "Ажилтны ярианы орчуулга", patient: "Өвчтөний ярианы орчуулга" },
    end: "Орчуулгыг дуусгах",
    backWarning: { title: "Орчуулгын үеэр энэ дэлгэц дээрээ байгаарай.", body: "Дуу ажиллахгүй бол ажилтнаас шинэ өрөө үүсгэхийг хүснэ үү." },
    connecting: { title: "Шууд орчуулгад холбогдож байна", body: "Анхны холболт хийгдэж байна. Түр хүлээнэ үү.", hint: "Товч улаан болох үед ярина уу." }
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

function copyFor(role: ParticipantRole, patientLanguage: PatientLanguage) {
  return role === "staff" ? staffCopy : patientCopies[patientLanguage];
}

export function VoiceRoom(props: VoiceRoomProps) {
  if ((props.roomMode ?? "consultation") !== "procedure") {
    return <ConsultationChatRoom initialRoom={props.initialRoom} role={props.role} roomToken={props.roomToken} />;
  }

  return <ProcedureVoiceRoom {...props} roomMode="procedure" />;
}

function ProcedureVoiceRoom({
  initialRoom,
  role,
  roomToken,
  roomMode = "consultation"
}: VoiceRoomProps) {
  const [room, setRoom] = useState(initialRoom);
  const [messages, setMessages] = useState<TranslationMessage[]>([]);
  const [speakingStartedAt, setSpeakingStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState("");
  const [translationDraft, setTranslationDraft] = useState("");
  const [inputTranscriptDraft, setInputTranscriptDraft] = useState("");
  const [backWarning, setBackWarning] = useState(false);
  const [wakeLockStatus, setWakeLockStatus] = useState("");
  const [hardwareInputStatus, setHardwareInputStatus] = useState("키보드 입력 대기");
  const [ttsStatus, setTtsStatus] = useState(`TTS ${TTS_DEBUG_VERSION}`);
  const [ttsSetupHint, setTtsSetupHint] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const roomRootRef = useRef<HTMLDivElement | null>(null);
  const hardwareCaptureRef = useRef<HTMLInputElement | null>(null);
  const realtimeClientRef = useRef<OpenAIRealtimeClient | null>(null);
  const realtimePreconnectStartedRef = useRef(false);
  const spokenMessageIdsRef = useRef(new Set<string>());
  const playedIntroKeyRef = useRef<string | null>(null);
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
  const latestMessage = messages[0];
  const isStaffAudioHub = role === "staff";
  const isConnectingRealtime = busy && !isSpeaking && /preparing|준비/i.test(realtimeStatus);
  const latestTargetLanguage = latestMessage?.targetLanguage ?? (latestMessage?.speaker === "staff" ? room.patientLanguage : "ko");
  const currentSpeechLanguage = speechLanguageByPatientLanguage[latestTargetLanguage];
  const currentSpeechLanguageLabel = latestTargetLanguage === "ko" ? "한국어" : languageLabels[latestTargetLanguage].native;
  const displayText = latestMessage
    ? role === "staff"
      ? latestMessage.speaker === "staff"
        ? latestMessage.sourceText || latestMessage.text
        : latestMessage.text
      : latestMessage.speaker === "staff"
        ? latestMessage.text
        : latestMessage.sourceText || latestMessage.text
    : inputTranscriptDraft || translationDraft;
  const displayLabel = latestMessage
    ? role === "staff"
      ? latestMessage.speaker === "staff"
        ? "병원 발화 원문"
        : "고객 발화 한국어 번역"
      : latestMessage.speaker === "staff"
        ? "병원 안내 번역"
        : "내 발화 원문"
    : role === "staff"
      ? "실시간 인식"
      : "시술 통역";

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
        onInputTranscriptDelta: setInputTranscriptDraft,
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

  const playBrowserTranslatedSpeech = useCallback((text: string, targetLanguage: PatientLanguage | "ko") => {
    if (!("speechSynthesis" in window)) {
      setError("This browser does not support device TTS.");
      setTtsStatus(`Device TTS unavailable / ${TTS_DEBUG_VERSION}`);
      return;
    }

    const lang = speechLanguageByPatientLanguage[targetLanguage];
    const languageLabel = targetLanguage === "ko" ? "한국어" : languageLabels[targetLanguage].native;
    const voice = findBrowserVoice(lang);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    if (voice) utterance.voice = voice;

    utterance.onerror = () => {
      setError(`${languageLabel} TTS voice could not be played on this device.`);
      setTtsStatus(`Device TTS error / ${lang} / ${TTS_DEBUG_VERSION}`);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setTtsStatus(
      voice
        ? `Device TTS / ${lang} / ${voice.name} / ${TTS_DEBUG_VERSION}`
        : `Device TTS / ${lang} / no matching voice listed / ${TTS_DEBUG_VERSION}`
    );
  }, [findBrowserVoice]);

  const playQueuedTranslatedSpeech = useCallback((message: TranslationMessage) => {
    const targetLanguage = message.targetLanguage ?? (message.speaker === "staff" ? room.patientLanguage : "ko");
    speechQueueRef.current = speechQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        playBrowserTranslatedSpeech(message.text, targetLanguage);
      });
  }, [playBrowserTranslatedSpeech, room.patientLanguage]);

  useEffect(() => {
    if (!isStaffAudioHub || !isProcedureMode || !room.patientJoinedAt || room.status === "ended") return;

    const introKey = `clinic-procedure-intro:${room.id}:${room.patientJoinedAt}`;
    if (playedIntroKeyRef.current === introKey || window.sessionStorage.getItem(introKey)) return;

    playedIntroKeyRef.current = introKey;
    window.sessionStorage.setItem(introKey, "played");
    const timer = window.setTimeout(() => {
      playBrowserTranslatedSpeech(procedureIntroCopies[room.patientLanguage], room.patientLanguage);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [isProcedureMode, isStaffAudioHub, playBrowserTranslatedSpeech, room.id, room.patientJoinedAt, room.patientLanguage, room.status]);

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
      void flushUsage();
      void releaseScreenWakeLock();
      stopPlayback();
      realtimeClientRef.current?.close();
      realtimeClientRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      mediaChunksRef.current = [];
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
    if (!isStaffAudioHub || !latestMessage || spokenMessageIdsRef.current.has(latestMessage.id)) return;

    spokenMessageIdsRef.current.add(latestMessage.id);
    playQueuedTranslatedSpeech(latestMessage);
  }, [isStaffAudioHub, latestMessage, playQueuedTranslatedSpeech]);

  useEffect(() => {
    if (!isProcedureMode) return;
    void requestScreenWakeLock();
    return () => {
      void releaseScreenWakeLock();
      stopPlayback();
    };
  }, [isProcedureMode, stopPlayback]);

  useEffect(() => {
    if (!isProcedureMode) return;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void requestScreenWakeLock();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isProcedureMode]);

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
    if (!isProcedureMode || role !== "staff" || room.status === "ended") return;

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
  }, [busy, isProcedureMode, isSpeaking, micEnabled, role, room.status]);

  useEffect(() => {
    if (role !== "staff") return;
    if (room.status !== "ready" || realtimePreconnectStartedRef.current || realtimeClientRef.current || !streamRef.current) return;
    realtimePreconnectStartedRef.current = true;
    void ensureRealtimeSession(streamRef.current).catch(() => {
      realtimePreconnectStartedRef.current = false;
    });
  }, [ensureRealtimeSession, role, room.status]);

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

  function createPatientAudioRecorder(stream: MediaStream) {
    if (!("MediaRecorder" in window)) {
      throw new Error("This browser does not support audio recording.");
    }

    const mimeType = preferredRecordingMimeType();
    return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  }

  async function startPatientRecording() {
    const acquiredTurn = await transition("patient_speaking");
    if (!acquiredTurn) {
      setError(copy.errors.busy);
      return;
    }

    const stream = await ensureMicStream();
    const recorder = createPatientAudioRecorder(stream);
    mediaChunksRef.current = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) mediaChunksRef.current.push(event.data);
    });
    recorder.start();
    mediaRecorderRef.current = recorder;
    setMicEnabled(true);
    setSpeakingStartedAt(Date.now());
    setRealtimeStatus("Recording patient turn");
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

  async function uploadPatientProcedureTurn(audio: Blob) {
    const clientTurnId = `${Date.now()}`;
    const formData = new FormData();
    formData.set("roomId", room.id);
    formData.set("role", "patient");
    formData.set("roomToken", roomToken ?? "");
    formData.set("clientTurnId", clientTurnId);
    formData.set("patientLanguage", room.patientLanguage);
    formData.set("audio", audio, `patient-${clientTurnId}.${audioFileExtension(audio.type)}`);

    const response = await fetch("/api/procedure-turns", {
      method: "POST",
      body: formData
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error ?? "Procedure turn translation failed.");
    }
    return data.message as RealtimeTranslationMessage;
  }

  async function startSpeaking() {
    setError("");
    setTranslationDraft("");
    setInputTranscriptDraft("");
    markActivity();
    setBusy(true);
    try {
      if (isProcedureMode) stopPlayback();
      if (role === "patient") {
        await startPatientRecording();
        return;
      }
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

    if (role === "patient") {
      try {
        await transition("translating_to_staff");
        setRealtimeStatus("Uploading patient turn");
        const audio = await stopPatientRecorder();
        mediaRecorderRef.current = null;
        if (audio.size <= 0) throw new Error("No audio was recorded.");
        const message = await uploadPatientProcedureTurn(audio);
        appendMessage(message);
        void broadcastTranslationMessage(room.id, message);
        setInputTranscriptDraft(message.sourceText ?? "");
        setTranslationDraft("");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Translation failed.");
      } finally {
        mediaChunksRef.current = [];
        await transition("ready");
        setBusy(false);
      }
      return;
    }

    const translatingStatus = role === "staff" ? "translating_to_patient" : "translating_to_staff";
    try {
      await transition(translatingStatus);
      const translatedText = await realtimeClientRef.current?.stopTurnAndTranslate({
        quietMs: PROCEDURE_TRANSLATION_QUIET_MS,
        maxMs: PROCEDURE_TRANSLATION_MAX_MS
      });
      if (!translatedText) throw new Error("No translated text was returned.");
      const normalizedText = normalizeClinicTranslation(translatedText, role === "staff" ? room.patientLanguage : "ko");
      const sourceText = realtimeClientRef.current?.getInputTranscript() || inputTranscriptDraft || "한국어 원문을 표시하지 못했습니다.";

      const message = {
        id: `${role}-${Date.now()}`,
        speaker: role,
        sourceText,
        text: normalizedText,
        targetLanguage: room.patientLanguage,
        createdAt: new Date().toISOString()
      } satisfies RealtimeTranslationMessage;

      appendMessage(message);
      void broadcastTranslationMessage(room.id, message);
      setTranslationDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Translation failed.");
    } finally {
      await transition("ready");
      setBusy(false);
    }
  }

  useEffect(() => {
    startSpeakingRef.current = startSpeaking;
    stopSpeakingRef.current = stopSpeaking;
  });

  return (
    <div
      ref={roomRootRef}
      className="space-y-4 outline-none"
      tabIndex={-1}
      onPointerDown={() => {
        roomRootRef.current?.focus();
        hardwareCaptureRef.current?.focus({ preventScroll: true });
      }}
    >
      <input
        ref={hardwareCaptureRef}
        aria-hidden="true"
        autoComplete="off"
        inputMode="none"
        readOnly
        tabIndex={-1}
        className="fixed left-0 top-0 h-px w-px opacity-0"
      />

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
        </div>
      </header>

      <section className="rounded-lg bg-white p-5 shadow-sm">
        {isConnectingRealtime ? (
          <article className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-4">
            <p className="text-xs font-bold text-trust">{copy.connecting.title}</p>
            <p className="mt-2 text-lg font-bold leading-7 text-ink">{copy.connecting.body}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{copy.connecting.hint}</p>
          </article>
        ) : null}

        {displayText ? (
          <article className="rounded-lg bg-blue-50 px-4 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-trust">{displayLabel}</p>
            <p className="mt-2 text-2xl font-bold leading-8 text-ink">{displayText}</p>
          </article>
        ) : (
          <p className="rounded-lg bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">
            {role === "staff" ? "병원폰에는 한국어 원문과 고객 발화의 한국어 번역이 표시됩니다." : "고객/보조 기기에는 고객 언어 텍스트만 표시됩니다."}
          </p>
        )}
      </section>

      <section className="rounded-lg bg-white p-5 text-center shadow-soft">
        <div className="mx-auto mb-5 max-w-sm">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-trust">{role === "staff" ? "browser tts audio hub" : "procedure text view"}</p>
          <h2 className="mt-2 text-2xl font-bold text-ink">{role === "staff" ? "병원 오디오 허브" : "고객/보조 기기"}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            {role === "staff"
              ? "풋패드나 버튼을 한 번 누르고 한국어로 말한 뒤, 다시 눌러 종료하세요. 번역 음성은 이 병원폰에서 재생됩니다."
              : "버튼을 한 번 누르고 답변한 뒤, 다시 눌러 종료하세요. 이 기기에는 텍스트만 표시됩니다."}
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
        {role === "staff" ? <p className="mt-2 text-sm font-semibold text-slate-500">풋패드 토글: 한 번 누르면 시작, 다시 누르면 종료. ↑ / Space / Enter 지원.</p> : null}
        {role === "staff" ? <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{hardwareInputStatus}</p> : null}
        {role === "staff" ? <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-trust">{ttsStatus}</p> : null}
        {role === "staff" ? (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={openGoogleTtsInstall} className="h-11 rounded-lg bg-trust px-4 text-sm font-bold text-white transition hover:bg-blue-700">
              TTS 앱 설치/업데이트
            </button>
            <button type="button" onClick={openDeviceTtsSettings} className="h-11 rounded-lg bg-slate-100 px-4 text-sm font-bold text-ink transition hover:bg-slate-200">
              {currentSpeechLanguageLabel} TTS 설정 열기
            </button>
          </div>
        ) : null}
        {role === "staff" && ttsSetupHint ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-3 text-left text-xs font-bold leading-5 text-amber-800">{ttsSetupHint}</p> : null}
        {wakeLockStatus ? <p className="mt-3 text-xs font-bold text-trust">{wakeLockStatus}</p> : null}
        {realtimeStatus ? <p className="mt-2 text-xs font-bold text-trust">{realtimeStatus}</p> : null}
        <p className="mt-2 text-sm font-semibold text-slate-500">{isSpeaking ? copy.helper.speaking : copy.helper.idle}</p>
        {error ? <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </section>

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
