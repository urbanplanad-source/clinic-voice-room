"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Languages, Loader2, LogOut, MessageSquareText, Stethoscope } from "lucide-react";
import { languageLabels, patientLanguages, type PatientLanguage } from "@/lib/languages";
import type { RoomMode } from "@/lib/room-mode";

const modeCopy: Record<RoomMode, { title: string; body: string; button: string }> = {
  consultation: {
    title: "AI translation consultation",
    body: "We will help with AI translation. Please choose your language.",
    button: "Confirm language"
  },
  procedure: {
    title: "AI translation during your procedure",
    body: "We will help you understand procedure guidance. Please choose your language.",
    button: "Confirm language"
  }
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
  const [error, setError] = useState("");

  async function createRoom(mode: RoomMode) {
    setLoadingMode(mode);
    setError("");
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
    const data = await response.json();
    router.push(`/staff/rooms/${data.room.id}`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className={selectedMode ? "space-y-3 md:space-y-4" : "space-y-5 md:space-y-6"}>
      <header className={`flex items-center justify-between gap-4 rounded-lg bg-ink text-white shadow-soft ${selectedMode ? "p-3 md:p-4" : "p-5 md:p-7"}`}>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-blue-200">{staff.hospital.name}</p>
          <h1 className={selectedMode ? "mt-0.5 text-xl font-bold leading-tight md:text-2xl" : "mt-1 text-[30px] font-bold leading-tight md:text-[36px]"}>
            {selectedMode ? "Choose patient language" : "Select translation mode"}
          </h1>
          <p className={selectedMode ? "hidden md:mt-1 md:block md:text-sm md:font-semibold md:leading-5 md:text-slate-300" : "mt-2 text-sm font-semibold leading-6 text-slate-300 md:text-base"}>
            {selectedMode ? modeCopy[selectedMode].body : "Choose the room type first. The patient will choose their language on the next screen."}
          </p>
        </div>
        <button
          onClick={logout}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/10 text-white transition hover:bg-white/15"
          aria-label="로그아웃"
          title="로그아웃"
        >
          <LogOut size={20} />
        </button>
      </header>

      {!selectedMode ? (
        <section className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setSelectedMode("consultation");
              setError("");
            }}
            className="flex min-h-[220px] flex-col justify-between rounded-lg bg-white p-6 text-left shadow-soft transition hover:bg-blue-50 md:min-h-[280px] md:p-8"
          >
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-blue-50 text-trust">
              <MessageSquareText size={28} />
            </span>
            <span>
              <span className="block text-[28px] font-bold leading-tight text-ink md:text-[34px]">상담방 만들기</span>
              <span className="mt-3 block text-base font-semibold leading-7 text-slate-500">텍스트 중심 AI 번역 상담</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedMode("procedure");
              setError("");
            }}
            className="flex min-h-[220px] flex-col justify-between rounded-lg bg-white p-6 text-left shadow-soft transition hover:bg-slate-50 md:min-h-[280px] md:p-8"
          >
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-slate-100 text-ink">
              <Stethoscope size={28} />
            </span>
            <span>
              <span className="block text-[28px] font-bold leading-tight text-ink md:text-[34px]">시술방 만들기</span>
              <span className="mt-3 block text-base font-semibold leading-7 text-slate-500">시술 중 안내 번역</span>
            </span>
          </button>
        </section>
      ) : (
        <section className="rounded-lg bg-white p-2.5 shadow-soft sm:p-3 md:p-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedMode(null);
                setError("");
              }}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm font-bold text-ink transition hover:bg-slate-200"
              aria-label="처음으로"
              title="처음으로"
            >
              <ArrowLeft size={18} />
              처음으로
            </button>
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-trust md:text-sm">
              {selectedMode === "consultation" ? "Consultation" : "Procedure"}
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
    </div>
  );
}
