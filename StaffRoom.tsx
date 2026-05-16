"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Link2, QrCode, Smartphone, Stethoscope } from "lucide-react";
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
  androidJoinUrl: string;
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

export function StaffRoom({ room, joinUrl, androidJoinUrl, roomMode = "consultation" }: StaffRoomProps) {
  const [snapshot, setSnapshot] = useState(room);
  const [copied, setCopied] = useState<"web" | "android" | null>(null);
  const connected = snapshot.status !== "waiting_for_patient";
  const copy = qrCopy[snapshot.patientLanguage];
  const isProcedureMode = roomMode === "procedure";
  const primaryQrUrl = joinUrl;
  const primaryQrCopy = isProcedureMode
    ? {
        icon: Smartphone,
        title: "Android 시술 앱 연결",
        body: "앱에서 방 토큰과 서버 주소가 자동으로 입력됩니다.",
        button: "앱 링크 복사",
        copied: "앱 링크 복사됨",
        target: "android" as const
      }
    : {
        icon: QrCode,
        title: copy.heading,
        body: copy.instruction,
        button: "환자 링크 복사",
        copied: "환자 링크 복사됨",
        target: "web" as const
      };
  const secondaryQrCopy = isProcedureMode
    ? {
        title: "환자 웹 입장 링크",
        body: "앱 연결이 어려우면 웹 링크로 바로 입장할 수 있습니다.",
        url: joinUrl,
        target: "web" as const
      }
    : {
        title: "Android 앱 자동입력 링크",
        body: "현장 테스트 앱에 서버 주소와 방 토큰을 자동으로 채웁니다.",
        url: androidJoinUrl,
        target: "android" as const
      };
  const PrimaryIcon = primaryQrCopy.icon;
  const tokenPreview = `${snapshot.roomToken.slice(0, 8)}...${snapshot.roomToken.slice(-6)}`;

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

  async function copyLink(value: string, target: "web" | "android") {
    await navigator.clipboard.writeText(value);
    setCopied(target);
    window.setTimeout(() => setCopied(null), 1600);
  }

  if (connected) {
    return <VoiceRoom initialRoom={snapshot} role="staff" roomMode={roomMode} />;
  }

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-lg bg-ink p-5 text-white shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-blue-200">{snapshot.hospital.name}</p>
            <h1 className="mt-2 text-[28px] font-bold leading-tight">
              {isProcedureMode
                ? `${languageLabels[snapshot.patientLanguage].ko} 시술 통역 대기`
                : `${languageLabels[snapshot.patientLanguage].ko} 상담 통역 대기`}
            </h1>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white">
            {isProcedureMode ? <Stethoscope size={15} /> : <QrCode size={15} />}
            {isProcedureMode ? "시술" : "상담"}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 text-left">
          <div className="rounded-lg bg-white/10 px-3 py-3">
            <p className="text-[11px] font-bold uppercase text-blue-100">Patient language</p>
            <p className="mt-1 text-base font-bold">{languageLabels[snapshot.patientLanguage].native}</p>
          </div>
          <div className="rounded-lg bg-white/10 px-3 py-3">
            <p className="text-[11px] font-bold uppercase text-blue-100">Room token</p>
            <p className="mt-1 truncate text-base font-bold">{tokenPreview}</p>
          </div>
        </div>
      </header>

      <section className="rounded-lg bg-white p-6 text-center shadow-soft">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-trust">
          <PrimaryIcon size={22} />
        </div>
        <h2 className="mt-4 text-xl font-bold text-ink">{isProcedureMode ? "Procedure patient device QR" : primaryQrCopy.title}</h2>
        {isProcedureMode ? (
          <p className="mx-auto mt-2 max-w-sm rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold leading-6 text-trust">
            Two-device web procedure mode: scan this QR on the patient device.
          </p>
        ) : null}
        <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-500">
          {isProcedureMode ? "Use a second web device near the patient. The doctor's device and patient device each use their own microphone." : primaryQrCopy.body}
        </p>
        <div className="mx-auto mt-5 inline-block rounded-lg border border-line bg-white p-5">
          <QRCodeCanvas
            value={primaryQrUrl}
            size={288}
            level="H"
            bgColor="#ffffff"
            fgColor="#000000"
            marginSize={4}
            className="block h-[288px] w-[288px] max-w-full"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
        <p className="mx-auto mt-5 max-w-sm break-all rounded-lg bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-600">{primaryQrUrl}</p>
        <button
          onClick={() => copyLink(primaryQrUrl, isProcedureMode ? "web" : primaryQrCopy.target)}
          className="mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-trust px-5 font-bold text-white transition hover:bg-blue-600"
        >
          {copied === (isProcedureMode ? "web" : primaryQrCopy.target) ? <Check size={18} /> : <Copy size={18} />}
          {isProcedureMode
            ? copied === "web"
              ? "Patient link copied"
              : "Copy patient link"
            : copied === primaryQrCopy.target
              ? primaryQrCopy.copied
              : primaryQrCopy.button}
        </button>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500">
            <Link2 size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{secondaryQrCopy.title}</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{secondaryQrCopy.body}</p>
            <p className="mt-3 break-all rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">{secondaryQrCopy.url}</p>
            <button
              onClick={() => copyLink(secondaryQrCopy.url, secondaryQrCopy.target)}
              className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-bold text-ink transition hover:bg-slate-200"
            >
              {copied === secondaryQrCopy.target ? <Check size={16} /> : <Copy size={16} />}
              {copied === secondaryQrCopy.target ? "복사됨" : "복사"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-blue-50 px-5 py-4 text-sm font-bold text-trust">{copy.waiting}</section>
    </div>
  );
}
