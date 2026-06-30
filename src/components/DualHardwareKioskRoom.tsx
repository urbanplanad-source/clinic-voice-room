"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Monitor } from "lucide-react";
import { languageLabels, type PatientLanguage } from "@/lib/languages";
import type { RoomStatus } from "@/lib/room-state";
import { VoiceRoom } from "@/components/VoiceRoom";

const staffHardwareKeys = ["PageUp", "33", "F8", "119"] as const;
const patientHardwareKeys = ["PageDown", "34", "F9", "120"] as const;
const staffHardwareMouseButtons = [1, 3] as const;
const patientHardwareMouseButtons = [2, 4] as const;

type KioskRoomSnapshot = {
  id: string;
  status: RoomStatus;
  patientLanguage: PatientLanguage;
  patientJoinedAt?: string | null;
  hospital?: { name: string };
  usageSession?: { totalRoomSeconds: number; roomStartedAt: string; roomEndedAt?: string | null } | null;
};

export function DualHardwareKioskRoom({
  room,
  patientJoinCode
}: {
  room: KioskRoomSnapshot;
  patientJoinCode: string;
}) {
  const [joinState, setJoinState] = useState<"joining" | "ready" | "error">("joining");
  const [joinedRoom, setJoinedRoom] = useState<KioskRoomSnapshot>(room);
  const [error, setError] = useState("");
  const language = languageLabels[room.patientLanguage];

  useEffect(() => {
    let cancelled = false;

    async function joinPatientSession() {
      setJoinState("joining");
      setError("");
      try {
        const response = await fetch(`/api/rooms/${room.id}/join-patient`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ joinCode: patientJoinCode })
        });
        const data = (await response.json().catch(() => null)) as { room?: KioskRoomSnapshot; error?: string } | null;
        if (cancelled) return;

        if (!response.ok || !data?.room) {
          setJoinState("error");
          setError(data?.error ?? "고객 세션을 준비하지 못했습니다.");
          return;
        }

        setJoinedRoom({
          ...room,
          ...data.room,
          hospital: { name: data.room.hospital?.name ?? room.hospital?.name ?? "Clinic Voice Room" },
          usageSession: room.usageSession ?? null
        });
        setJoinState("ready");
      } catch {
        if (cancelled) return;
        setJoinState("error");
        setError("네트워크가 지연되고 있습니다. 새로고침 후 다시 시도해주세요.");
      }
    }

    void joinPatientSession();
    return () => {
      cancelled = true;
    };
  }, [patientJoinCode, room]);

  if (joinState !== "ready") {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-950 p-6 text-white">
        <section className="w-full max-w-md rounded-lg bg-white p-6 text-ink shadow-soft">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-blue-50 text-trust">
              {joinState === "joining" ? <Loader2 size={26} className="animate-spin" /> : <AlertTriangle size={26} />}
            </span>
            <div>
              <p className="text-lg font-bold">{joinState === "joining" ? "설치형 통역 준비 중" : "고객 세션 준비 실패"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{joinState === "joining" ? "고객 화면을 같은 브라우저 세션에 연결하고 있습니다." : error}</p>
            </div>
          </div>
          {joinState === "error" ? (
            <Link href="/staff/kiosk" className="mt-5 flex h-12 items-center justify-center rounded-lg bg-trust px-4 font-bold text-white">
              다시 시작
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-950 p-3 text-ink md:p-4">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-soft">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-ink">
            <Monitor size={22} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-500">{joinedRoom.hospital?.name ?? "Clinic Voice Room"}</p>
            <h1 className="truncate text-lg font-bold leading-tight text-ink md:text-xl">설치형 대면 통역 · {language.ko}</h1>
          </div>
        </div>
        <div className="hidden shrink-0 gap-2 text-sm font-bold text-slate-500 md:flex">
          <span className="rounded-lg bg-blue-50 px-3 py-2 text-trust">상담사 PageUp / F8</span>
          <span className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">고객 PageDown / F9</span>
        </div>
      </div>

      <div className="grid min-h-[calc(100dvh-96px)] gap-3 xl:grid-cols-2">
        <section className="min-w-0 rounded-lg bg-slate-100 p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Staff Monitor</p>
              <h2 className="text-2xl font-bold text-ink">상담사</h2>
            </div>
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-trust">PageUp · F8</span>
          </div>
          <VoiceRoom
            initialRoom={joinedRoom}
            role="staff"
            roomMode="procedure"
            kioskMode
            hardwareKeys={staffHardwareKeys}
            hardwareMouseButtons={staffHardwareMouseButtons}
            hardwareLabel="상담사 입력: PageUp / F8 / 마우스 휠 클릭 / 마우스 뒤로 버튼"
          />
        </section>

        <section className="min-w-0 rounded-lg bg-slate-100 p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Customer Monitor</p>
              <h2 className="text-2xl font-bold text-ink">고객</h2>
            </div>
            <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">PageDown · F9</span>
          </div>
          <VoiceRoom
            initialRoom={joinedRoom}
            role="patient"
            roomMode="procedure"
            kioskMode
            hardwareKeys={patientHardwareKeys}
            hardwareMouseButtons={patientHardwareMouseButtons}
            hardwareLabel="고객 입력: PageDown / F9 / 마우스 우클릭 / 마우스 앞으로 버튼"
          />
        </section>
      </div>
    </main>
  );
}
