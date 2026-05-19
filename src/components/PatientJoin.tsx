"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mic, ShieldCheck, Volume2 } from "lucide-react";
import { languageLabels, type PatientLanguage } from "@/lib/languages";
import { broadcastRoomUpdate } from "@/lib/supabase-realtime";

const copy: Record<
  PatientLanguage,
  { title: string; body: string; procedureBody: string; consent: string; button: string; denied: string; languageLabel: string }
> = {
  zh: {
    title: "医院翻译室",
    body: "请允许使用麦克风。不需要安装应用或注册账号。",
    procedureBody: "治疗过程中会播放翻译语音。请保持屏幕开启，并将手机放在身边。",
    consent: "为提供口译服务，您的语音可能会由外部 AI 服务处理。本服务不会保存原始语音或完整对话记录。",
    button: "进入房间",
    denied: "无法使用麦克风。请在浏览器设置中允许麦克风权限。",
    languageLabel: "中文翻译"
  },
  ja: {
    title: "病院通訳ルーム",
    body: "マイクの使用を許可してください。アプリのインストールやアカウント登録は不要です。",
    procedureBody: "施術中に通訳音声が再生されます。画面をオンにしたまま、端末をそばに置いてください。",
    consent: "通訳のため、音声が外部AIサービスで処理される場合があります。元の音声や会話全文は保存しません。",
    button: "入室する",
    denied: "マイクを使用できません。ブラウザ設定でマイクの使用を許可してください。",
    languageLabel: "日本語通訳"
  },
  en: {
    title: "Hospital Interpretation Room",
    body: "Please allow microphone access. No app installation or account is required.",
    procedureBody: "Translated audio may play during the procedure. Please keep this screen on and place the phone nearby.",
    consent: "To provide interpretation, your voice may be processed by an external AI service. We do not store raw audio or full conversation transcripts.",
    button: "Enter room",
    denied: "Microphone is unavailable. Please allow microphone access in your browser settings.",
    languageLabel: "English interpretation"
  },
  ru: {
    title: "Кабинет перевода в клинике",
    body: "Разрешите доступ к микрофону. Установка приложения и регистрация не требуются.",
    procedureBody: "Во время процедуры может воспроизводиться перевод. Оставьте экран включенным и положите телефон рядом.",
    consent: "Для перевода ваш голос может обрабатываться внешним AI-сервисом. Мы не сохраняем исходную аудиозапись или полный текст разговора.",
    button: "Войти",
    denied: "Микрофон недоступен. Разрешите доступ к микрофону в настройках браузера.",
    languageLabel: "Перевод на русский"
  },
  vi: {
    title: "Phòng phiên dịch bệnh viện",
    body: "Vui lòng cho phép truy cập micro. Không cần cài ứng dụng hoặc tạo tài khoản.",
    procedureBody: "Âm thanh phiên dịch có thể được phát trong quá trình thực hiện thủ thuật. Vui lòng để màn hình bật và đặt điện thoại gần bạn.",
    consent: "Để cung cấp phiên dịch, giọng nói của bạn có thể được xử lý bởi dịch vụ AI bên ngoài. Chúng tôi không lưu âm thanh gốc hoặc toàn bộ nội dung cuộc trò chuyện.",
    button: "Vào phòng",
    denied: "Không thể sử dụng micro. Vui lòng cho phép quyền micro trong cài đặt trình duyệt.",
    languageLabel: "Phiên dịch tiếng Việt"
  },
  id: {
    title: "Ruang Interpretasi Klinik",
    body: "Izinkan akses mikrofon. Tidak perlu memasang aplikasi atau membuat akun.",
    procedureBody: "Audio terjemahan dapat diputar selama prosedur. Tetap nyalakan layar dan letakkan ponsel di dekat Anda.",
    consent: "Untuk menyediakan interpretasi, suara Anda dapat diproses oleh layanan AI eksternal. Kami tidak menyimpan audio mentah atau transkrip percakapan lengkap.",
    button: "Masuk",
    denied: "Mikrofon tidak tersedia. Izinkan akses mikrofon di pengaturan browser.",
    languageLabel: "Interpretasi Bahasa Indonesia"
  }
};

export function PatientJoin({
  room,
  roomMode = "consultation"
}: {
  room: { id: string; roomToken: string; patientLanguage: PatientLanguage; hospital: { name: string } };
  roomMode?: "consultation" | "procedure";
}) {
  const router = useRouter();
  const text = copy[room.patientLanguage];
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function enterRoom() {
    setLoading(true);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const response = await fetch(`/api/rooms/${room.id}/join-patient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomToken: room.roomToken })
      });
      if (!response.ok) throw new Error("Room join failed");
      const data = await response.json();
      await broadcastRoomUpdate(data.room);
      router.replace(`/room/${room.roomToken}?mode=${roomMode}`);
    } catch {
      setError(text.denied);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-lg bg-white shadow-soft">
      <div className="bg-ink p-6 text-white sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-blue-200">{room.hospital.name}</p>
            <h1 className="mt-3 text-[30px] font-bold leading-tight">{text.title}</h1>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold">
            <ShieldCheck size={15} />
            Guest
          </span>
        </div>
        <p className="mt-3 text-base font-semibold leading-7 text-slate-300">
          {roomMode === "procedure" ? text.procedureBody : text.body}
        </p>
      </div>

      <div className="mx-6 mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-4 text-sm font-semibold leading-6 text-slate-700 sm:mx-7">
        <div className="flex gap-3">
          <Volume2 size={20} className="mt-0.5 shrink-0 text-trust" />
          <p>{text.consent}</p>
        </div>
      </div>

      <div className="m-6 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-4 sm:m-7">
        <div>
          <p className="text-xs font-bold text-slate-500">{text.languageLabel}</p>
          <p className="mt-1 text-lg font-bold text-ink">{languageLabels[room.patientLanguage].native}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-trust">
          <Mic size={22} />
        </div>
      </div>

      {error ? <p className="mx-6 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 sm:mx-7">{error}</p> : null}

      <button
        onClick={enterRoom}
        disabled={loading}
        className="mx-6 mb-6 flex h-14 w-[calc(100%-3rem)] items-center justify-center gap-2 rounded-lg bg-trust px-4 text-lg font-bold text-white transition hover:bg-blue-600 disabled:opacity-50 sm:mx-7 sm:mb-7 sm:w-[calc(100%-3.5rem)]"
      >
        {loading ? "..." : text.button}
        <ArrowRight size={20} />
      </button>
    </section>
  );
}
