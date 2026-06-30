"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Keyboard, Languages, Loader2 } from "lucide-react";
import { languageLabels, patientLanguages, type PatientLanguage } from "@/lib/languages";

type CreatedRoom = {
  id: string;
};

export function InstallKioskSetup({
  staff
}: {
  staff: { name: string; hospital: { name: string; planType: string }; role: string };
}) {
  const router = useRouter();
  const [patientLanguage, setPatientLanguage] = useState<PatientLanguage>("zh");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startKioskRoom() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientLanguage, roomMode: "procedure" })
      });
      const data = (await response.json().catch(() => null)) as { room?: CreatedRoom; error?: string; activeRoomCount?: number; activeRoomLimit?: number } | null;
      setLoading(false);

      if (!response.ok || !data?.room?.id) {
        if (response.status === 429 && data?.activeRoomLimit) {
          setError(`현재 열린 통역방이 ${data.activeRoomCount}개입니다. 병원 동시 사용 한도 ${data.activeRoomLimit}개에 도달했습니다.`);
          return;
        }
        if (response.status === 401) {
          setError("로그인이 만료되었습니다. 다시 로그인해주세요.");
          router.replace("/login");
          return;
        }
        setError(data?.error ?? "설치형 통역방을 만들지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      router.replace(`/staff/kiosk/${data.room.id}`);
    } catch {
      setLoading(false);
      setError("네트워크가 지연되고 있습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-96px)] flex-col space-y-5 md:space-y-6">
      <header className="rounded-lg bg-ink p-5 text-white shadow-soft md:p-7">
        <p className="truncate text-sm font-bold text-blue-200">{staff.hospital.name}</p>
        <h1 className="mt-2 text-[30px] font-bold leading-tight md:text-[36px]">설치형 대면 통역</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300 md:text-base">
          한 대의 PC 화면을 양쪽 모니터에 펼쳐 놓고, 상담사 버튼과 고객 버튼으로 번갈아 말합니다.
        </p>
      </header>

      <section className="rounded-lg bg-white p-4 shadow-soft md:p-5">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-ink shadow-sm">
            <Keyboard size={24} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">하드웨어 버튼 설정</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">상담사 버튼은 PageUp, 고객 버튼은 PageDown으로 설정합니다.</p>
          </div>
        </div>

        <div className="mt-5">
          <h2 className="text-xl font-bold text-ink">고객 언어</h2>
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5 md:gap-2 lg:gap-3" role="radiogroup" aria-label="Choose customer language">
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
        </div>

        <button
          type="button"
          onClick={startKioskRoom}
          disabled={loading}
          className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-trust px-5 text-lg font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? <Loader2 size={24} className="animate-spin" /> : <Languages size={24} />}
          설치형 통역 시작
        </button>

        {error ? <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-700">{error}</p> : null}
      </section>

      <div className="mt-auto grid gap-3 sm:grid-cols-2">
        <Link
          href="/staff"
          className="flex h-14 items-center justify-center gap-2 rounded-lg bg-white px-5 text-base font-bold text-ink shadow-soft transition hover:bg-slate-50"
        >
          <ArrowLeft size={22} />
          직원 화면
        </Link>
        <Link
          href="/staff/text-translate"
          className="flex h-14 items-center justify-center gap-2 rounded-lg bg-emerald-50 px-5 text-base font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
        >
          텍스트 번역
        </Link>
      </div>
    </div>
  );
}
