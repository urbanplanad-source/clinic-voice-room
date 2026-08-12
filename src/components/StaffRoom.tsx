"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { Check, Copy, Link2, Loader2, PhoneOff, QrCode, Smartphone } from "lucide-react";
import { VoiceRoom } from "./VoiceRoom";
import { type PatientLanguage } from "@/lib/languages";
import type { RoomStatus } from "@/lib/room-state";
import { subscribeToRoomUpdates } from "@/lib/supabase-realtime";
import { useAdaptivePolling } from "@/lib/use-adaptive-polling";
import { EndRoomDialog } from "./EndRoomDialog";

type StaffRoomProps = {
  room: {
    id: string;
    status: RoomStatus;
    patientLanguage: PatientLanguage;
    patientJoinedAt?: string | null;
    hospital: { name: string };
  };
  joinUrl: string;
  androidJoinUrl?: string;
  roomMode?: "consultation" | "procedure";
};

const qrCopy: Partial<Record<PatientLanguage, { heading: string; instruction: string; waiting: string }>> = {
  zh: {
    heading: "请扫描二维码",
    instruction: "请使用手机相机扫描下方二维码，进入医院翻译室。",
    waiting: "正在等待患者进入"
  },
  yue: {
    heading: "請掃描 QR Code",
    instruction: "請用手機相機掃描下方 QR Code，進入醫院翻譯室。",
    waiting: "正在等待患者進入"
  },
  zh_tw: {
    heading: "請掃描 QR Code",
    instruction: "請使用手機相機掃描下方 QR Code，進入醫院翻譯室。",
    waiting: "正在等待患者進入"
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
  th: {
    heading: "กรุณาสแกน QR Code",
    instruction: "ใช้กล้องโทรศัพท์สแกน QR Code ด้านล่างเพื่อเข้าห้องล่ามของโรงพยาบาล",
    waiting: "กำลังรอผู้ป่วยเข้าห้อง"
  },
  ms: {
    heading: "Imbas kod QR",
    instruction: "Gunakan kamera telefon untuk mengimbas kod QR di bawah dan masuk ke bilik interpretasi.",
    waiting: "Menunggu pesakit masuk"
  },
  tl: {
    heading: "I-scan ang QR code",
    instruction: "Gamitin ang camera ng telepono upang i-scan ang QR code sa ibaba at pumasok sa interpretation room ng ospital.",
    waiting: "Hinihintay na pumasok ang pasyente"
  },
  mn: {
    heading: "QR код уншуулна уу",
    instruction: "Утасны камераар доорх QR кодыг уншуулж эмнэлгийн орчуулгын өрөөнд орно уу.",
    waiting: "Өвчтөн орохыг хүлээж байна"
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
  },
  fr: {
    heading: "Scannez le code QR",
    instruction: "Utilisez l'appareil photo du téléphone pour scanner le code QR et entrer dans la salle d'interprétation.",
    waiting: "En attente de l'arrivée du patient"
  },
  es: {
    heading: "Escanee el código QR",
    instruction: "Use la cámara del teléfono para escanear el código QR y entrar en la sala de interpretación.",
    waiting: "Esperando a que entre el paciente"
  },
  de: {
    heading: "QR-Code scannen",
    instruction: "Scannen Sie den QR-Code mit der Handykamera und betreten Sie den Dolmetschraum.",
    waiting: "Warten auf den Patienten"
  },
  it: {
    heading: "Scansiona il codice QR",
    instruction: "Usa la fotocamera del telefono per scansionare il codice QR ed entrare nella stanza di interpretariato.",
    waiting: "In attesa dell'ingresso del paziente"
  },
  pt: {
    heading: "Escaneie o código QR",
    instruction: "Use a câmera do celular para escanear o código QR e entrar na sala de interpretação.",
    waiting: "Aguardando a entrada do paciente"
  }
};

const defaultQrCopy = qrCopy.en ?? {
  heading: "Scan the QR code",
  instruction: "Use your phone camera to scan the QR code below and enter the interpretation room.",
  waiting: "Waiting for the patient to join"
};

export function StaffRoom({ room, joinUrl, roomMode = "consultation" }: StaffRoomProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(room);
  const [copied, setCopied] = useState<"web" | "android" | null>(null);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [returning, setReturning] = useState(false);
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [endError, setEndError] = useState("");
  const [roomRealtimeHealthy, setRoomRealtimeHealthy] = useState(false);
  const connected = snapshot.status !== "waiting_for_patient";
  const copy = qrCopy[snapshot.patientLanguage] ?? defaultQrCopy;
  const isProcedureMode = roomMode === "procedure";
  const primaryQrUrl = joinUrl;
  const primaryQrCopy = isProcedureMode
    ? {
        icon: Smartphone,
        title: "시술 웹 연결",
        body: "환자 기기에서 웹 통역방으로 바로 입장합니다.",
        button: "환자 링크 복사",
        copied: "환자 링크 복사됨",
        target: "web" as const
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
        body: "QR 스캔이 어려우면 이 웹 링크를 환자 기기에 직접 공유하세요.",
        url: joinUrl,
        target: "web" as const
      }
    : {
        title: "환자 웹 입장 링크",
        body: "QR 스캔이 어려우면 이 웹 링크를 환자 기기에 직접 공유하세요.",
        url: joinUrl,
        target: "web" as const
      };
  const PrimaryIcon = primaryQrCopy.icon;
  useEffect(() => {
    return subscribeToRoomUpdates(room.id, (updatedRoom) => {
      setSnapshot((current) => ({ ...current, ...updatedRoom }));
    }, (status) => {
      setRoomRealtimeHealthy(status === "SUBSCRIBED");
    }) ?? undefined;
  }, [room.id]);

  useEffect(() => {
    void fetch(`/api/rooms/${room.id}/warm-glossary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }).catch(() => undefined);
  }, [room.id]);

  useAdaptivePolling({
    enabled: !connected,
    isRealtimeHealthy: roomRealtimeHealthy,
    healthyIntervalMs: 15_000,
    unhealthyIntervalMs: 5000,
    pollKey: `staff-room:${room.id}`,
    poll: async () => {
      const response = await fetch(`/api/rooms/${room.id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Room polling failed.");
      const data = await response.json();
      setSnapshot(data.room);
    }
  });

  async function copyLink(value: string, target: "web" | "android") {
    await navigator.clipboard.writeText(value);
    setCopied(target);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function verifyRoomEnded() {
    try {
      const response = await fetch(`/api/rooms/${room.id}`, { cache: "no-store" });
      const data = await response.json().catch(() => null) as { room?: typeof snapshot } | null;
      if (response.ok && data?.room) {
        setSnapshot(data.room);
        return data.room.status === "ended";
      }
    } catch {
      // Keep the QR visible until the room state can be verified.
    }
    return false;
  }

  async function endRoomAndReturn() {
    if (returning) return;
    setReturning(true);
    setEndError("");
    let ended = false;
    try {
      const response = await fetch(`/api/rooms/${room.id}/end`, { method: "POST" });
      ended = response.ok;
    } catch {
      ended = false;
    }
    ended = ended || await verifyRoomEnded();
    setReturning(false);
    if (!ended) {
      setEndError("네트워크 오류로 종료 여부를 확인하지 못했습니다. QR을 닫지 말고 상태를 다시 확인해주세요.");
      return;
    }
    setEndDialogOpen(false);
    router.replace("/staff");
    router.refresh();
  }

  if (connected) {
    return <VoiceRoom initialRoom={snapshot} role="staff" roomMode={roomMode} />;
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <section className="rounded-lg bg-white px-4 py-4 text-center shadow-soft md:px-6">
        <div className="mb-3 text-left">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-trust-text md:text-sm">{snapshot.hospital.name}</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-ink md:text-3xl">{copy.heading}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">{copy.instruction}</p>
          </div>
        </div>
        <div
          className="mx-auto inline-block rounded-lg border border-line bg-white p-3 md:p-4"
          style={{
            colorScheme: "light",
            forcedColorAdjust: "none",
            filter: "none",
            WebkitFilter: "none"
          }}
        >
          <QRCodeCanvas
            value={primaryQrUrl}
            size={300}
            level="H"
            bgColor="#ffffff"
            fgColor="#000000"
            marginSize={4}
            className="block h-[300px] w-[300px] max-w-full"
            style={{
              background: "#ffffff",
              colorScheme: "light",
              display: "block",
              filter: "none",
              forcedColorAdjust: "none",
              imageRendering: "pixelated",
              WebkitFilter: "none"
            }}
          />
        </div>
        <div className="mx-auto mt-3 grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-trust-text">
          <PrimaryIcon size={20} />
        </div>
        <h2 className="mt-2 text-xl font-bold text-ink md:text-2xl">{copy.waiting}</h2>
        {isProcedureMode ? (
          <p className="mx-auto mt-1 max-w-sm rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold leading-5 text-trust-text md:text-sm">
            환자 기기에서 이 QR을 스캔하면 시술 통역방으로 입장합니다.
          </p>
        ) : null}
        <p className="mx-auto mt-1 max-w-sm text-sm font-semibold leading-5 text-slate-500">
          {isProcedureMode ? "환자 휴대폰 화면을 켜둔 채 가까운 곳에 두세요." : primaryQrCopy.body}
        </p>
        <p className="sr-only">{primaryQrUrl}</p>
        <button
          onClick={() => copyLink(primaryQrUrl, isProcedureMode ? "web" : primaryQrCopy.target)}
          className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-trust px-5 font-bold text-white transition hover:bg-blue-600"
        >
          {copied === (isProcedureMode ? "web" : primaryQrCopy.target) ? <Check size={18} /> : <Copy size={18} />}
          {isProcedureMode
            ? copied === "web"
              ? "환자 링크 복사됨"
              : "환자 링크 복사"
            : copied === primaryQrCopy.target
              ? primaryQrCopy.copied
              : primaryQrCopy.button}
        </button>
        <button
          type="button"
          onClick={() => setQrExpanded(true)}
          className="ml-2 mt-3 inline-flex h-11 items-center justify-center rounded-lg bg-slate-100 px-5 font-bold text-ink transition hover:bg-slate-200"
        >
          QR 크게 보기
        </button>
      </section>

      {qrExpanded ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white p-5"
          style={{
            colorScheme: "light",
            forcedColorAdjust: "none",
            filter: "none",
            WebkitFilter: "none"
          }}
        >
          <div className="w-full max-w-[420px] text-center text-black">
            <p className="text-base font-bold text-black">QR 코드를 스캔하세요</p>
            <div
              className="mx-auto mt-5 inline-block bg-white p-6"
              style={{
                colorScheme: "light",
                forcedColorAdjust: "none",
                filter: "none",
                WebkitFilter: "none"
              }}
            >
              <QRCodeCanvas
                value={primaryQrUrl}
                size={340}
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
                marginSize={4}
                className="block h-[340px] w-[340px] max-w-full"
                style={{
                  background: "#ffffff",
                  colorScheme: "light",
                  display: "block",
                  filter: "none",
                  forcedColorAdjust: "none",
                  imageRendering: "pixelated",
                  WebkitFilter: "none"
                }}
              />
            </div>
            <p className="mx-auto mt-4 max-w-sm break-all rounded-lg bg-slate-100 px-3 py-3 text-sm font-bold leading-6 text-black">{primaryQrUrl}</p>
            <button
              type="button"
              onClick={() => setQrExpanded(false)}
              className="mt-5 h-12 rounded-lg bg-black px-6 font-bold text-white"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}

      <section className="rounded-lg border border-line bg-white p-3 shadow-sm md:p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500">
            <Link2 size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{secondaryQrCopy.title}</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 md:text-sm">{secondaryQrCopy.body}</p>
            <p className="mt-2 break-all rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">{secondaryQrCopy.url}</p>
            <button
              onClick={() => copyLink(secondaryQrCopy.url, secondaryQrCopy.target)}
              className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-bold text-ink transition hover:bg-slate-200"
            >
              {copied === secondaryQrCopy.target ? <Check size={16} /> : <Copy size={16} />}
              {copied === secondaryQrCopy.target ? "복사됨" : "복사"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-blue-50 px-4 py-3 text-sm font-bold text-trust-text">{copy.waiting}</section>

      <button
        type="button"
        onClick={() => setEndDialogOpen(true)}
        disabled={returning}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-rose-50 px-5 text-base font-bold text-rose-600 shadow-sm transition hover:bg-rose-100 disabled:opacity-50 md:h-16 md:text-lg"
      >
        {returning ? <Loader2 size={22} className="animate-spin" /> : <PhoneOff size={22} />}
        방 종료 후 직원 화면으로
      </button>
      <EndRoomDialog open={endDialogOpen} ending={returning} error={endError} onCancel={() => { setEndDialogOpen(false); setEndError(""); }} onConfirm={() => void endRoomAndReturn()} onRetry={() => void verifyRoomEnded().then((ended) => { if (ended) { router.replace("/staff"); router.refresh(); } else setEndError("방이 아직 열려 있습니다. 네트워크를 확인한 뒤 종료를 다시 시도해주세요."); })} />
    </div>
  );
}
