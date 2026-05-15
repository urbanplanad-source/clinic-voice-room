"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, QrCode } from "lucide-react";
import { VoiceRoom } from "./VoiceRoom";
import { languageLabels, type PatientLanguage } from "@/lib/languages";
import type { RoomStatus } from "@/lib/room-state";
import { subscribeToRoomUpdates } from "@/lib/supabase-realtime";

type StaffRoomProps = {
  room: {
    id: string;
    roomToken: string;
    status: RoomStatus;
    patientLanguage: PatientLanguage;
    hospital: { name: string };
  };
  joinUrl: string;
  roomMode?: "consultation" | "procedure";
};

const qrCopy: Record<PatientLanguage, { heading: string; instruction: string; waiting: string }> = {
  zh: {
    heading: "请扫描二维码",
    instruction: "请使用手机相机扫描下方二维码，进入医院翻译室。",
    waiting: "正在等待患者进入"
  },
  ja: {
    heading: "QRコードをスキャンしてください",
    instruction: "スマートフォンのカメラで下のQRコードを読み取り、通訳ルームに入室してください。",
    waiting: "患者さんの入室を待っています"
  },
  en: {
    heading: "Scan the QR code",
    instruction: "Use your phone camera to scan the QR code below and enter the interpretation room.",
    waiting: "Waiting for the patient to join"
  },
  ru: {
    heading: "Отсканируйте QR-код",
    instruction: "Откройте камеру телефона, отсканируйте QR-код и войдите в кабинет перевода.",
    waiting: "Ожидаем вход пациента"
  },
  vi: {
    heading: "Vui lòng quét mã QR",
    instruction: "Dùng camera điện thoại quét mã QR bên dưới để vào phòng phiên dịch.",
    waiting: "Đang chờ bệnh nhân vào phòng"
  },
  id: {
    heading: "Pindai kode QR",
    instruction: "Gunakan kamera ponsel untuk memindai kode QR di bawah dan masuk ke ruang interpretasi.",
    waiting: "Menunggu pasien masuk"
  }
};

export function StaffRoom({ room, joinUrl, roomMode = "consultation" }: StaffRoomProps) {
  const [snapshot, setSnapshot] = useState(room);
  const [copied, setCopied] = useState(false);
  const connected = snapshot.status !== "waiting_for_patient";
  const copy = qrCopy[snapshot.patientLanguage];

  useEffect(() => {
    return subscribeToRoomUpdates(room.id, (updatedRoom) => {
      setSnapshot((current) => ({ ...current, ...updatedRoom }));
    }) ?? undefined;
  }, [room.id]);

  useEffect(() => {
    if (connected) return;
    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/rooms/${room.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setSnapshot(data.room);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [connected, room.id]);

  async function copyLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (connected) {
    return <VoiceRoom initialRoom={snapshot} role="staff" roomMode={roomMode} />;
  }

  return (
    <div className="space-y-5">
      <header className="rounded-lg bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-trust">{snapshot.hospital.name}</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight">
          {roomMode === "procedure" ? `${languageLabels[snapshot.patientLanguage].ko} 시술 통역 대기실` : `${languageLabels[snapshot.patientLanguage].ko} 통역 대기실`}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {roomMode === "procedure" ? "환자용 병원 스마트폰에서 QR을 열고 침대 옆에 놓아주세요." : copy.heading}
        </p>
      </header>

      <section className="rounded-lg bg-white p-6 text-center shadow-soft">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-trust">
          <QrCode size={22} />
        </div>
        <h2 className="mt-4 text-xl font-bold text-ink">{copy.heading}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500">{copy.instruction}</p>
        <div className="mx-auto mt-5 inline-block rounded-lg border border-line bg-white p-4">
          <QRCodeSVG value={joinUrl} size={224} level="M" />
        </div>
        <p className="mx-auto mt-5 max-w-sm break-all rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-600">{joinUrl}</p>
        <button
          onClick={copyLink}
          className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-trust px-5 font-bold text-white transition hover:bg-blue-600"
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? "복사됨" : "링크 복사"}
        </button>
      </section>

      <section className="rounded-lg bg-blue-50 px-5 py-4 text-sm font-bold text-trust">{copy.waiting}</section>
    </div>
  );
}
