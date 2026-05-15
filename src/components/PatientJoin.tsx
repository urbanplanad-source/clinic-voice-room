"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mic } from "lucide-react";
import { languageLabels, type PatientLanguage } from "@/lib/languages";
import { broadcastRoomUpdate } from "@/lib/supabase-realtime";

const copy: Record<PatientLanguage, { title: string; body: string; button: string; denied: string; languageLabel: string }> = {
  zh: {
    title: "医院翻译室",
    body: "请允许使用麦克风。不需要安装应用或注册账号。",
    button: "进入房间",
    denied: "无法使用麦克风。请在浏览器设置中允许麦克风权限。",
    languageLabel: "中文翻译"
  },
  ja: {
    title: "病院通訳ルーム",
    body: "マイクの使用を許可してください。アプリのインストールやアカウント登録は不要です。",
    button: "入室する",
    denied: "マイクを使用できません。ブラウザ設定でマイクの使用を許可してください。",
    languageLabel: "日本語通訳"
  },
  en: {
    title: "Hospital Interpretation Room",
    body: "Please allow microphone access. No app installation or account is required.",
    button: "Enter room",
    denied: "Microphone is unavailable. Please allow microphone access in your browser settings.",
    languageLabel: "English interpretation"
  },
  ru: {
    title: "Кабинет перевода в клинике",
    body: "Разрешите доступ к микрофону. Установка приложения и регистрация не требуются.",
    button: "Войти",
    denied: "Микрофон недоступен. Разрешите доступ к микрофону в настройках браузера.",
    languageLabel: "Перевод на русский"
  },
  vi: {
    title: "Phòng phiên dịch bệnh viện",
    body: "Vui lòng cho phép truy cập micro. Không cần cài ứng dụng hoặc tạo tài khoản.",
    button: "Vào phòng",
    denied: "Không thể sử dụng micro. Vui lòng cho phép quyền micro trong cài đặt trình duyệt.",
    languageLabel: "Phiên dịch tiếng Việt"
  },
  id: {
    title: "Ruang Interpretasi Klinik",
    body: "Izinkan akses mikrofon. Tidak perlu memasang aplikasi atau membuat akun.",
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
    <section className="rounded-lg bg-white p-6 shadow-soft sm:p-7">
      <p className="text-sm font-bold text-trust">{room.hospital.name}</p>
      <h1 className="mt-3 text-[30px] font-bold leading-tight text-ink">{text.title}</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">
        {roomMode === "procedure" ? "시술 중 통역 음성이 재생됩니다. 화면을 켜둔 상태로 침대 옆에 놓아주세요." : text.body}
      </p>

      <div className="mt-6 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-4">
        <div>
          <p className="text-xs font-bold text-slate-500">{text.languageLabel}</p>
          <p className="mt-1 text-lg font-bold text-ink">{languageLabels[room.patientLanguage].native}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-trust">
          <Mic size={22} />
        </div>
      </div>

      {error ? <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

      <button
        onClick={enterRoom}
        disabled={loading}
        className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-trust px-4 text-lg font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? "..." : text.button}
        <ArrowRight size={20} />
      </button>
    </section>
  );
}
