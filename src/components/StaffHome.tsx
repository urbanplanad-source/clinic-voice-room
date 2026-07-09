"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Keyboard, Languages, Loader2, LogOut, MessageSquareText, QrCode, Stethoscope } from "lucide-react";
import { languageLabels, patientLanguages, type PatientLanguage } from "@/lib/languages";
import type { RoomMode } from "@/lib/room-mode";
import type { RoomStatus } from "@/lib/room-state";
import { StaffRoom } from "./StaffRoom";

const modeCopy: Record<RoomMode, { title: string; body: string; button: string }> = {
  consultation: {
    title: "상담 통역방",
    body: "상대방과 채팅하듯이 음성 번역을 주고받습니다.",
    button: "상담 통역방 생성"
  },
  procedure: {
    title: "시술 통역방",
    body: "시술 중 누워 있는 환자에게 짧은 안내를 바로 들려줍니다.",
    button: "시술 통역방 생성"
  }
};

type CreatedRoom = {
  id: string;
  status: RoomStatus;
  patientLanguage: PatientLanguage;
  patientJoinCode?: string | null;
  patientJoinedAt?: string | null;
  roomMode: RoomMode;
  hospital?: { name?: string | null };
};

export function StaffHome({
  staff
}: {
  staff: { name: string; hospital: { name: string; planType: string }; role: string };
}) {
  const router = useRouter();
  const [patientLanguage, setPatientLanguage] = useState<PatientLanguage>("zh");
  const [selectedMode, setSelectedMode] = useState<RoomMode | null>(null);
  const [loadingMode, setLoadingMode] = useState<RoomMode | null>(null);
  const [createdRoom, setCreatedRoom] = useState<CreatedRoom | null>(null);
  const [error, setError] = useState("");

  async function createRoom(mode: RoomMode) {
    setLoadingMode(mode);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientLanguage, roomMode: mode })
      });
      setLoadingMode(null);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 429 && data?.activeRoomLimit) {
          setError(`현재 열린 통역방이 ${data.activeRoomCount}개입니다. 병원 동시 사용 한도 ${data.activeRoomLimit}개에 도달했습니다. 사용하지 않는 방을 종료하거나 관리자에게 한도 상향을 요청해주세요.`);
          return;
        }
        if (response.status === 401) {
          setError("로그인이 만료되었습니다. 다시 로그인해주세요.");
          router.replace("/login");
          return;
        }
        setError(data?.error ?? "통역방을 만들지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const data = (await response.json()) as { room: CreatedRoom };
      if (!data.room?.patientJoinCode) {
        router.push(`/staff/rooms/${data.room.id}`);
        return;
      }
      setCreatedRoom(data.room);
      window.history.pushState(null, "", `/staff/rooms/${data.room.id}`);
    } catch {
      setLoadingMode(null);
      setError("네트워크가 지연되고 있습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (createdRoom) {
    const baseUrl = window.location.origin;
    const roomMode = createdRoom.roomMode ?? selectedMode ?? "procedure";
    const joinUrl = `${baseUrl}/room/join/${createdRoom.patientJoinCode}?mode=${roomMode}`;
    const androidJoinUrl = `clinicvoiceroom://room/join?joinCode=${encodeURIComponent(createdRoom.patientJoinCode ?? "")}&mode=${roomMode}&backend=${encodeURIComponent(baseUrl)}`;

    return (
      <StaffRoom
        room={{
          id: createdRoom.id,
          status: createdRoom.status,
          patientLanguage: createdRoom.patientLanguage,
          patientJoinedAt: createdRoom.patientJoinedAt ?? null,
          hospital: { name: createdRoom.hospital?.name ?? staff.hospital.name }
        }}
        joinUrl={joinUrl}
        androidJoinUrl={androidJoinUrl}
        roomMode={roomMode}
      />
    );
  }

  return (
    <div className={selectedMode ? "flex min-h-[calc(100dvh-96px)] flex-col space-y-3 md:space-y-4" : "flex min-h-[calc(100dvh-96px)] flex-col space-y-5 md:space-y-6"}>
      <header className={`flex items-center justify-between gap-4 rounded-lg bg-ink text-white shadow-soft ${selectedMode ? "p-3 md:p-4" : "p-5 md:p-7"}`}>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-blue-200">{staff.hospital.name}</p>
          <h1 className={selectedMode ? "mt-0.5 text-xl font-bold leading-tight md:text-2xl" : "mt-1 text-[30px] font-bold leading-tight md:text-[36px]"}>
            {selectedMode ? "환자 언어 선택" : "통역 기능 선택"}
          </h1>
          <p className={selectedMode ? "hidden md:mt-1 md:block md:text-sm md:font-semibold md:leading-5 md:text-slate-300" : "mt-2 text-sm font-semibold leading-6 text-slate-300 md:text-base"}>
            {selectedMode ? modeCopy[selectedMode].body : "시술 QR 통역, 설치형 대면 통역, 텍스트 번역만 운영합니다."}
          </p>
        </div>
      </header>

      {!selectedMode ? (
        <>
          <section className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setSelectedMode("procedure");
                setError("");
              }}
              className="flex min-h-[220px] flex-col justify-between rounded-lg bg-white p-6 text-left shadow-soft transition hover:bg-blue-50 md:min-h-[280px] md:p-8"
            >
              <span className="grid h-14 w-14 place-items-center rounded-lg bg-blue-50 text-trust">
                <QrCode size={28} />
              </span>
              <span>
                <span className="block text-[28px] font-bold leading-tight text-ink md:text-[34px]">시술 QR 통역</span>
                <span className="mt-3 block text-base font-semibold leading-7 text-slate-500">고객 휴대폰 QR 연결</span>
              </span>
            </button>

            <Link
              href="/staff/kiosk"
              className="flex min-h-[220px] flex-col justify-between rounded-lg bg-white p-6 text-left shadow-soft transition hover:bg-slate-50 md:min-h-[280px] md:p-8"
            >
              <span className="grid h-14 w-14 place-items-center rounded-lg bg-slate-100 text-ink">
                <Keyboard size={28} />
              </span>
              <span>
                <span className="block text-[28px] font-bold leading-tight text-ink md:text-[34px]">설치형 대면 통역</span>
                <span className="mt-3 block text-base font-semibold leading-7 text-slate-500">양쪽 모니터와 하드웨어 버튼</span>
              </span>
            </Link>
          </section>

          <Link
            href="/staff/text-translate"
            className="flex min-h-[96px] items-center gap-4 rounded-lg bg-white p-5 text-left shadow-soft transition hover:bg-emerald-50 md:min-h-[112px] md:p-6"
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-emerald-50 text-mint">
              <FileText size={28} />
            </span>
            <span className="min-w-0">
              <span className="block text-[24px] font-bold leading-tight text-ink md:text-[30px]">텍스트 번역하기</span>
              <span className="mt-2 block text-sm font-semibold leading-6 text-slate-500 md:text-base">상담 문장 바로 번역</span>
            </span>
          </Link>
        </>
      ) : (
        <section className="rounded-lg bg-white p-2.5 shadow-soft sm:p-3 md:p-4">
          <div className="flex justify-end">
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-trust md:text-sm">
              Procedure
            </span>
          </div>

          <div className="mt-2 md:mt-3">
            <h2 className="text-lg font-bold leading-tight text-ink md:text-2xl">{modeCopy[selectedMode].title}</h2>
            <p className="mt-1 hidden text-sm font-semibold leading-5 text-slate-500 sm:block md:text-base">{modeCopy[selectedMode].body}</p>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5 md:gap-2 lg:gap-3" role="radiogroup" aria-label="Choose your language">
          {patientLanguages.map((language) => {
            const active = language === patientLanguage;
            return (
              <button
                key={language}
                type="button"
                onClick={() => setPatientLanguage(language)}
                className={`min-h-[58px] rounded-lg border px-1.5 py-1.5 text-center transition sm:min-h-[62px] md:min-h-[70px] md:px-2 md:py-2 ${
                  active ? "border-trust bg-blue-50 text-trust" : "border-line bg-white text-slate-600 hover:bg-slate-50"
                }`}
                aria-pressed={active}
              >
                <span className="block break-keep text-sm font-bold leading-5 md:text-base">{languageLabels[language].native}</span>
                <span className="mt-0.5 block truncate text-[10px] font-semibold leading-4 md:text-[11px]">{languageLabels[language].english}</span>
              </button>
            );
          })}
          </div>

          <button
            onClick={() => createRoom(selectedMode)}
            disabled={loadingMode !== null}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-trust px-5 text-base font-bold text-white transition hover:bg-blue-600 disabled:opacity-50 md:h-14 md:text-lg"
          >
            {loadingMode === selectedMode ? <Loader2 size={24} className="animate-spin" /> : <Languages size={24} />}
            {modeCopy[selectedMode].button}
          </button>

          {error ? <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-700">{error}</p> : null}
        </section>
      )}

      {!selectedMode && staff.role !== "staff" ? (
        <section className="grid gap-2 rounded-lg bg-white p-3 shadow-soft sm:grid-cols-2">
          <Link href="/admin/glossary" className="flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold text-ink transition hover:bg-blue-50">
            <Languages size={18} />
            Glossary
          </Link>
          <Link href="/admin/quick-phrases" className="flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold text-ink transition hover:bg-blue-50">
            <MessageSquareText size={18} />
            Quick Phrases
          </Link>
          <Link href="/admin/feedback" className="flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold text-ink transition hover:bg-blue-50">
            <MessageSquareText size={18} />
            Feedback
          </Link>
          <Link href="/admin/samples" className="flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold text-ink transition hover:bg-blue-50">
            <FileText size={18} />
            Samples
          </Link>
          {staff.role === "internal_admin" ? (
            <>
              <Link href="/admin/staff" className="flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold text-ink transition hover:bg-blue-50">
                <Stethoscope size={18} />
                Staff
              </Link>
              <Link href="/admin/usage" className="flex h-12 items-center justify-center gap-2 rounded-lg bg-slate-50 px-3 text-sm font-bold text-ink transition hover:bg-blue-50">
                <Languages size={18} />
                Usage
              </Link>
            </>
          ) : null}
        </section>
      ) : null}

      <div className="mt-auto pt-4">
        {selectedMode ? (
          <button
            type="button"
            onClick={() => {
              setSelectedMode(null);
              setError("");
            }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 text-base font-bold text-ink shadow-soft transition hover:bg-slate-50 md:h-16 md:text-lg"
            aria-label="처음으로"
            title="처음으로"
          >
            <ArrowLeft size={22} />
            처음으로
          </button>
        ) : (
          <button
            type="button"
            onClick={logout}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-rose-50 px-5 text-base font-bold text-rose-600 shadow-sm transition hover:bg-rose-100 md:h-16 md:text-lg"
            aria-label="로그아웃"
            title="로그아웃"
          >
            <LogOut size={22} />
            로그아웃
          </button>
        )}
      </div>
    </div>
  );
}
